import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
         console.log("Cookies", req.cookies);
         console.log("Headers", req.headers);
        
        const token = req.Cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        console.log("Received Token:", token); // Debugging log

        if (!token) {
            throw new ApiError(401, "Unauthorized request: Token missing");
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        // console.log("Decoded Token:", decodedToken); // Debugging log

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
        if (!user) {
            throw new ApiError(401, "Invalid Access Token: User not found");
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("JWT Verification Error:", error); // Debugging log
        throw Error(401, error?.message || "Invalid access token");
    }
});