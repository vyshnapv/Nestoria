
const Admin = require("../../models/adminModel");
const bcrypt = require('bcrypt');
const mongoose=require("mongoose");

//admin login
const loadLogin=(req,res)=>
{
    if(req.session.admin)
    {
        return res.redirect("/admin/dashboard")
    }
    res.render("adminlog",{message:null})
}



const login = async (req, res) => {
    try {
      const { email, password } = req.body;
      const admin = await Admin.findOne({ email });

      if (admin) {
        if (password === admin.password) {
          req.session.admin = true;
          return res.redirect("/admin");
          
        } else {
          return res.render("adminlog", { message: "Incorrect password. Please try again."});
        }

        
      } else {
        return res.render("adminlog", { message: "Incorrect email. Please try again." });
      }
    } catch (error) {
      console.error("Login error", error);
      return res.redirect("/pageerror");
    }
  };

//dashboard
const loadDashboard=async(req,res)=>
{
    if(req.session.admin)
   {
    try {
        res.render("dashboard")
    } catch (error) {
        res.redirect("/pageerror")
    }
   }
}

//page Error
const pageerror=async(req,res)=>{
    res.render("adminerror")
}


module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,

}