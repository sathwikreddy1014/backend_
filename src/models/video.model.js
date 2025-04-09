import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";


const videoSchema = new Schema(
    {
        videoFile:{
            type: String,  // 3rd party url
            required: true
        },
        thumbNail:{
            type: String,
            required: true
        },
        title:{
            type: String, 
            required: true
        },
        description:{
            type: String,  
            required: true
        },
        duration:{
            type: Number,  // 3rd party url
            required: true
        },
        views:{
            type: Number,
            default: 0
        },
        isPublished:{
            type: Boolean
            default: true
        },
        owner:{
            Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps:true
    }
)

videoSchema.plugin(mongooseAggregatePaginate)
export const Video = mongoose.model("Video", videoSchema)