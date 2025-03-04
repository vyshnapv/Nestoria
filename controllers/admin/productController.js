const Product = require("../../models/productModel");
const User = require("../../models/userModel");
const Category = require("../../models/categoryModel");
const fs=require("fs")
const path=require("path")
const sharp=require("sharp")

//get the product add page 
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

const addProducts = async (req, res) => {
    try {
        const products = req.body;

        const productExists = await Product.findOne({
            productName: products.productName,
        });
            
        if (!productExists) {
            const images = [];
            if (req.files && req.files.length > 0) {
                req.files.map(file => {
                    images.push(file.filename)
                })
            }
 
            const categoryId = await Category.findOne({_id: products.category});
            
            if (!categoryId) {
                return res.status(400).json({ message: "Invalid category name" });
            }

            if (images.length === req.files.length) {
                const newProduct = new Product({
                    productName: products.productName,
                    description: products.description,
                    category: categoryId._id,
                    regularPrice: products.regularPrice,
                    quantity: products.quantity,
                    productImage: images,
                    status: 'Available',
                });

            await newProduct.save();
            return res.redirect("/admin/Products");
        }  else {
            return res.status(400).json({ 
                message: "Some images failed to process. Please try again." 
            });
        }
    } else {
        return res.status(400).json({ 
            message: "Product already exists, please try with another name" 
        });
    }
  } catch (error) {
        console.error("Error saving product:", error);
        return res.status(500).json({ 
            message: "An error occurred while saving the product",
            error: error.message 
        });
    }
};

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

//get edit product page 
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
const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findById(id);
        const data = req.body;

        const { deletedImages } = req.body;

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existingProduct) {
            return res.status(400).json({ error: "Product name already exists" });
        }
        let updatedImages = [...product.productImage]; 

        if (deletedImages) {
            const imagesToDelete = JSON.parse(deletedImages);

            imagesToDelete.forEach((image) => {
                const imagePath = path.join(__dirname, '../public/uploads/', image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath); 
                }
                updatedImages = updatedImages.filter(img => img !== image);
            });
        }

        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                updatedImages.push(file.filename); 
            });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                productName: data.productName,
                description: data.description,
                regularPrice: data.regularPrice,
                quantity: data.quantity,
                category: data.category,
                productImage: updatedImages,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ error: "Failed to update product" });
        }

        res.status(200).json(({
            success: true,
            redirectUrl: "/admin/products"
        }))

    } catch (error) {
        console.error('Error in editProduct:', error);
        res.status(500).redirect("/pageerror");
    }
};

module.exports={
    getProductAddPage,
    getAllProducts,
    addProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
}