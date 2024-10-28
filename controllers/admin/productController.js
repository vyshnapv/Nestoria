const Product = require("../../models/productModel");
const User = require("../../models/userModel");
const Category = require("../../models/categoryModel");
const fs=require("fs")
const path=require("path")
const sharp=require("sharp")



const getProductAddPage=async(req,res)=>{
    try {
        const category=await Category.find({isListed:true})
        res.render("productadd",{
            category,
        })
    } catch (error) {
       
        res.redirect("/pageerror")
    }
}

const addProducts = async (req, res) => {
    try {
        const products = req.body;

        const productExists = await Product.findOne({
            productName: products.productName,
        });
            
        if (!productExists) {
            const images = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join('public', 'uploads', 'cropped',  req.files[i].filename);
                    await sharp(originalImagePath).resize({width: 440, height: 440}).toFile(resizedImagePath); 
                    images.push(req.files[i].filename);
                    
                }
            }
            const categoryId = await Category.findOne({_id: products.category});
            
            if (!categoryId) {
                return res.status(400).json({ message: "Invalid category name" });
            }

            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                createdOn: new Date(),
                quantity: products.quantity,
                size: products.size,
                color: products.color,
                productImage: images,
                status: 'Available',
            });

            await newProduct.save();
           return res.redirect("/admin/Products")
        } else {
            return res.status(400).json({ message: "Product already exists, please try with another name" });
        }
    } catch (error) {
        console.error("Error saving product", error);
        return res.redirect("/admin/pageerror");
    }
};

//product list page
const getAllProducts=async(req,res)=>{
    try {
        const search=req.query.search || "";
        const page=parseInt(req.query.page) || 1;
        const limit=4;
        const skip=(page-1)*limit

        const productData=await Product.find({
            
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
            ],
        }).skip(skip).limit(limit).populate("category").exec()


        const count=await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
            ],
        }).countDocuments();

        const category=await Category.find({isListed:true});

        if(category)
        {
            res.render("products",{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,
                search: search,
            })
        }
        else{
            res.render("page-404");
        }
    } catch (error) {
        console.error(error);
        res.redirect("/pageerror")
    }
}


//block properties
const blockProduct=async(req,res)=>{
    try {
        let id=req.query.id;
        const result = await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
        
        if (!result) {
           
            return res.json({ message: "Product not found or already blocked." });
        }
        res.json({ message: "Product blocked successfully" });
    } catch (error) {
        console.error(error); 
        res.json({ message: "Failed to block the product" });
    }
}

//unblock category
const unblockProduct = async (req, res) => {
    try {
        let id=req.query.id;
        const result = await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
        
        if (!result) {
           
            return res.json({ message: "Product not found or already unblocked." });
        }
        res.json({ message: "Product unblocked successfully" });
    } catch (error) {
        console.error(error);
        res.json({ message: "Failed to unblock the product" });
    }
}

//edit product
const getEditProduct=async(req,res)=>{
    try {
        const id=req.query.id;
        const product=await Product.findOne({_id:id});
        const category=await Category.find({})

        res.render("editproduct",{
            product:product,
            cat:category,
        })
        
    } catch (error) {
      console.error('Error in getEditProduct:', error);
        res.redirect("/pageerror");
    }
}

//edit product
const editProduct = async (req, res)=>{
    try {
       const id = req.params.id;
       const product = await Product.findOne({_id:id});
       const data = req.body;


         const existingProduct = await Product.findOne({
          productName: data.productName,
          _id: {$ne:id}
      })
    
    if(existingProduct) {
         return res.status(400).json({error: "Product with this name already exists. Please try with another name"});
     }
    
    const images=[];

      if(req.files && req.files.length>0){
        for(let i=0;i<req.files.length;i++){
            images.push(req.files[i].filename);
        }
    }

      const updateFields = {
           productName:data.productName,
           description:data.description,
           category: product.category,
           regularPrice:data.regularPrice,
           salePrice:data.salePrice,
           quantity:data.quantity,
           color:data.color,
        }  

        if(req.files.length>0){
            updateFields.$push={productImage:{$each:images}};
        }

      
        await Product.findByIdAndUpdate(id,updateFields,{new:true});
        res.redirect("/admin/products")
    
    } catch (error) {
        console.error('Error in editProduct:', error);
        res.redirect("/pageerror");
    }
 }

module.exports={
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
}