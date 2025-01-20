const Product = require("../../models/productModel");
const Offer = require("../../models/offerModel");
const Category = require("../../models/categoryModel");

//offer management page
const offerManagement=async(req,res)=>{
    try {
        res.render("offerManagement")
    } catch (error) {
        res.redirect("/pageerror") 
    }
}


//load product offer page 
const loadProductOffer=async(req,res)=>{
    try {
        res.render("productOffer")
    } catch (error) {
        res.redirect("/pageerror")
    }
}

//load category offer page
const loadCategoryOffer= async(req,res)=>{
    try {
        res.render("categoryOffer")
    } catch (error) {
        res.redirect("/pageerror")
    }
}


module.exports={
    offerManagement,
    loadProductOffer,
    loadCategoryOffer
}