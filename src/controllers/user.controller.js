import { asyncHandler } from "../utils/asynchandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import  ApiResponce  from "../utils/ApiResponce.js";
import jwt from "jsonwebtoken";
import mongoose  from "mongoose";

const generateAccessAndRefereshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {

     // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {fullName, email, username, password } = req.body

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }


    // console.log("Request Body:", req.body);
    // console.log("req.files:", req.files); // Log req.files HERE to check if Multer is working
  
    // Check if files were uploaded FIRST
    if (!req.files || Object.keys(req.files).length === 0) {
      throw new ApiError(400, "Avatar and/or Cover Image file is required"); // Or just "No files uploaded"
    }
  
    const avatarFile = req.files.avatar && req.files.avatar[0];
    const coverImageFile = req.files.coverImage && req.files.coverImage[0];
  
    if (!avatarFile) {
      throw new ApiError(400, "Avatar file is required");
    }
  
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = coverImageFile ? coverImageFile.path : null; // Handle missing cover image
  
    // ... (rest of your code to upload to Cloudinary and create the user)
  
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("Cloudinary avatar response:", avatar); // Inspect the full response

    const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null;
    console.log("Cloudinary coverImage response:", coverImage); // Inspect the full response
    // ... (use avatar.url and coverImage?.url in your User.create call)
  
    const user = await User.create({
      fullName,
      avatar: avatar.url,
      coverImage: coverImage?.url || "", // Handle case where coverImage
      email, 
      password,
      username: username.toLowerCase()
    });
  

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // return res.status(201).json(
    //     new ApiResponce(200, createdUser, "User registered Successfully")
    // )
    return res.status(201).json({
        status:201,
        data: createdUser,
        message: "User registered Successfully"
    });


});

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const {email, username, password} = req.body
    console.log(email);

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
  
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
        
    // }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

   const isPasswordValid = await user.isPasswordCorrect(password)
    console.log((password))
   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
    }

   const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json({
        status:200, 
        data:{
            user: loggedInUser, accessToken, refreshToken
        },
        message:"User logged In Successfully"
    })

})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json({
        satus:200, 
        data:{}, 
        message:"User logged Out"})
})

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request");
    }
    
    try {
        const decodedToken= jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET 
        )
    
        const user = await User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401,"invalid refresh token");
        }
    
        if (incomingRefreshToken != user?.refreshToken) {
            throw new ApiError(401, "refresh token is expired or used");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newrefreshToken}= await generateAccessAndRefereshTokens(user._id)
    
        return res.status(200)
        .cookie("accesToken", accessToken)
        .cookie("refreshToken", newrefreshToken)
        .json({
            status:200,
            data: {accessToken,newrefreshToken},
            message: "Access token refresh successfully"
        })
    } catch (error) {
        throw new ApiError(401,"invalid");
    }
})

const changeCurrentPassword = asyncHandler(async(req, res)=> {
    console.log(req.body);
    
    const {oldPassword, newPassword} = req.body
    console.log(req.body);
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "invalid old password");
    }
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(201).json({
        status:201,
        data: [],
        message: "User Successfully changed password"
    });
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(200,"current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} =req.body

    if (!(fullname || email)) {
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json({
        statusCode:200,
        data: {user},
        message:"updated successfully"
    })
})

const updateUserAvatar = asyncHandler(async(req, res) => {

    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is Missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error While uploading on avatar");
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200),
    json({
        statusCode:200,
        data:{user},
        message:"coverimage updated successfully"
    })

})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is Missing");
    }

    const coverImage = await uploadOnCloudinary(avatarLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error While uploading on coverImage");
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200),
    json({
        statusCode:200,
        data:{user},
        message:"coverimage updated successfully"
    })
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params
    if (!username) {
        console.log("username is missing")          
    }
    if (username) {
        console.log("username is present")          
    }

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
       {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])
    console.log(channel.length)

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponce(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregrate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "watchHistory",
                forienField: "_id",
                as: "watchHistory",
                pipeLine: [
                    {
                        $lookup:{
                            from: "users",
                            localField: "owner",
                            forienField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(200,
        user[0].watchHistory,
        "watchhistory fetched successfully"
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}