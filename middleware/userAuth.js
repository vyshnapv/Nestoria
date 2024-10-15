const User = require("../models/userModel");

const userAuth = async (req, res, next) => {
    try {
        if (req.session.user) {
            const user = await User.findById(req.session.user);
            if (user && !user.is_blocked) {
                return next(); // User is authenticated, continue to next middleware or route
            }
        }
        res.redirect("/login"); // Redirect to login if user is not authenticated or blocked
    } catch (error) {
        console.error("Error in user authentication middleware:", error);
        res.status(500).send("Internal Server Error");
    }
};

const userNotAuth = async (req, res, next) => {
    try {
        if (req.session.user) {
            return res.redirect("/");
        }
        next(); // User is not authenticated, continue to next middleware or route
    } catch (error) {
        console.error("Error in user not authenticated middleware:", error);
        res.status(500).send("Internal Server Error");
    }
};



const userAuth1 = async (req, res, next) => {
    try {
        if (req.session.user) {
            const user = await User.findById(req.session.user);
            if (user && !user.is_blocked) {
                return next(); // User is authenticated, continue to next middleware or route
            }
        }
        res.json({success:false}); // Redirect to login if user is not authenticated or blocked
    } catch (error) {
        console.error("Error in user authentication middleware:", error);
        res.status(500).send("Internal Server Error");
    }
};


const adminAuth=(req,res,next)=>{
        User.findOne({is_admin:true})  
        .then(data=>{
            if(data )
            {
                next();
            }else{
                res.redirect("/admin/login")
            }
        })
        .catch(error=>{
            console.log("Error in admin auth middleware",error);
            res.status(500).send("Internal server error")
        })  
}


module.exports={
                userAuth,
                userAuth1,
                userNotAuth,
                adminAuth,
              }
    


