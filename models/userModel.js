const mongoose=require("mongoose");


const UserSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true,
    },
    email:{
        type:String,
        required:true,
        unique:true,
    },
    mobile:{
        type:String,
        required:false,
        unique:true,
        sparse:true,
        default:null,
    },
    password:{
        type:String,
        required:false,
    },
    googleId:{
        type:String,
        unique:true,
    },
    is_admin:{
        type:Boolean,
        default:false,
    },
    is_verified:{
        type:Boolean,
        default:false,
    },
    is_blocked:{
        type:Boolean,
        default:false,
    },

});

module.exports=mongoose.model("User",UserSchema)