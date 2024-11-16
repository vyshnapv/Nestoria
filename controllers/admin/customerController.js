const User = require("../../models/userModel");

const customerInfo=async(req,res)=>{
    try {
        let search="";
        if(req.query.search)
            {
                search=req.query.search
            }  
         let page=1;
         if(req.query.page)
         {
            page=req.query.page
         }
        
         const limit=5
         
         const userData=await User.find({
            is_admin:false,
            $or:[
                {name:{$regex:".*"+search+".*",$options:"i"}}, 
                {email:{$regex:".*"+search+".*",$options:"i"}},
                {mobile:{$regex:".*"+search+".*", $options:'i'}},
            ],
         })

         .limit(limit*1)
         .skip((page-1)*limit)
         .exec();

         const count=await User.find({
            is_admin:false,
            $or:[
                {name:{$regex:".*"+search+".*",$options:"i"}},
                {email:{$regex:".*"+search+".*",$options:"i"}},
                {mobile:{$regex:".*"+search+".*", $options:'i'}},
            ],
         }).countDocuments();

         const totalPages = Math.ceil(count / limit);
     
         res.render("customer", {
            data: userData,
            totalPages: totalPages,
            currentPage: page,
            search:search
         });
    } catch (error) {
        console.error(error); 
        res.status(500).send("Internal Server Error");
    }
}

//customer blocked
const customerBlocked=async(req,res)=>{
    try {
        let id = req.query.id;
        const result=await User.updateOne({ _id: id }, { $set: { is_blocked: true } });

        if (!result) {
           
            return res.json({ message: "Product not found or already blocked." });
        }
        res.json({ message: "User has been blocked successfully." }); 
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

//customer unblocked
const customerunBlocked=async(req,res)=>{
    try {
        let id = req.query.id;
        const result=await User.updateOne({ _id: id }, { $set: { is_blocked: false } });
        if (!result) {
           
            return res.json({ message: "Product not found or already unblocked." });
        }
        res.json({ message: "User has been unblocked successfully." }); 
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" }); 
    }
}



module.exports={
    customerInfo,
    customerBlocked,
    customerunBlocked,
}