const Category = require("../../models/categoryModel");


const categoryInfo=async(req,res)=>{
    try {
        const page=parseInt(req.query.page) || 1;
        const limit=4;
        const skip=(page-1)*limit;
         
        //access categories from database 
        const categoryData=await Category.find({})
        .sort({createdAt:-1})//sort in decending order
        .skip(skip)
        .limit(limit);
        
        //total categories count for calculate total pages
        const totalCategories=await Category.countDocuments();
        //calculate total pages
        const totalPages=Math.ceil(totalCategories / limit);
        res.render("category",{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories:totalCategories
        })
           
    } catch (error) {
        console.error(error);
        res.status(500).render("error", { message: "Internal Server Error" });          
    }
}

//category add
const addCategory=async(req,res)=>{
    const {name,description}=req.body;
    try {
        const normalizedName=name.trim().toLowerCase();
        const existingCategory=await Category.findOne({ name: { $regex: new RegExp(`^${normalizedName}$`, 'i') } });

        if(existingCategory)
        {
            return res.status(400).json({error:"category already exist"})
        }
     //if categoy not existed we add it
        const newCategory=new Category({
            name:normalizedName,
            description,
        })

        await newCategory.save();//SAVE IT TO DATABASE
        return res.json({message:"Category Added Successfully"})
        
    } catch (error) {
        console.error(error);
        
        return res.status(500).json({error:"Internal server error"})
    }
}

//list category
const getListCategory=async(req,res)=>{
    try {
        let id=req.query.id;
        const result=await Category.updateOne({ _id: id }, { $set: { isListed: false } });

        if(!result){
            return res.json({message:"Category not found or already unlisted"})
        }
        res.json({message:"Product unlisted successfully"})
    } catch (error) {
        console.error(error);
        res.json({message:"Filed to unlist the product"})
    }
}


//unlist category
const getUnListCategory=async(req,res)=>{
    try {
        let id=req.query.id;
        const result=await Category.updateOne({ _id: id }, { $set: { isListed: true } }); 

        if(!result){
            return res.json({message:"Category not found or already listed"})
        }
        res.json({message:"Product listed successfully"})
    } catch (error) {
        console.error(error);
        res.json({message:"Filed to list the product"})
    }
}

//get edit category
const getEditCategory=async(req,res)=>{
    try {
        const id=req.query.id;
        const category=await Category.findOne({_id:id});
    res.render("editcategory", { category: category });
    } catch (error) {
        res.redirect("/pageerror");
    }
}

//category edit post
const editCategory=async(req,res)=>{
    try {
         const id=req.params.id;
         const {categoryName,description}=req.body;
        const normalizedName = categoryName.trim().toLowerCase();

        const existingCategory = await Category.findOne({
            _id: { $ne: id },
            name: { $regex: new RegExp(`^${normalizedName}$`, 'i') }
          });

         if(existingCategory){
            return res.status(400).json({error:"Category exists,please choose another name"})
         }

         const updateCategory=await Category.findByIdAndUpdate(id,{
            name:normalizedName,
            description:description,
         },{new:true})
         
         if(updateCategory)
         {
            res.redirect("/admin/category")
         }
         else
         {
            res.status(404).json({error:"Category not found"})
         }
    } catch (error) {
        res.status(500).json({error:"Internal server error"})
    }
}

module.exports={
    categoryInfo,
    addCategory,
    getListCategory,
    getUnListCategory,
    getEditCategory,
    editCategory,
}