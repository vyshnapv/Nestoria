
const Admin = require("../../models/adminModel");
const bcrypt = require('bcrypt');
const mongoose=require("mongoose");

//admin loadlogin
const loadLogin=(req,res)=>
{
    res.render("adminlog",{message:null})
}


//admin login
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


//logout admin
const logoutAdmin=async(req,res)=>{
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Error logging out');
    }
    res.redirect('/admin/login');
  });
  
}


//admindashboard
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
    logoutAdmin,
    loadDashboard,
    pageerror,

}