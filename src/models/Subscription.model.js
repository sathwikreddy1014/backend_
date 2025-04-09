import mongoose, {Schema} from "mongoose"

const subscriptionSchema = new Schema({
    subscriber:{
        typeof: Schema.Types.ObjectId, 
        ref:"User"
    }
    channel :{
        typeof: Schema.Types.ObjectId, 
        ref:"User"
    }
}, {timeStamps: true}) 


export const Subscription = mongoose.model("Subscription", subscriptionSchema)