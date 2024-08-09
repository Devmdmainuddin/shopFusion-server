const express = require('express');
const cors =require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, Timestamp } = require('mongodb');
require('dotenv').config();
const app = express()
const port = process.env.PORT || 5000


app.use(cors({
    origin:[
        'http://localhost:5173',
        'http://localhost:5174',
    ],
    credentials: true
}))

app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.sk1ew0y.mongodb.net/?retryWrites=true&w=majority&appName=cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const productCollection = client.db("shopFusion").collection("product")
    const userCollection = client.db("shopFusion").collection("users")
    const reviewsCollection = client.db("shopFusion").collection("reviews")
    const paymentCollection = client.db("shopFusion").collection("payment")
    
     // auth related api
     app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCRSS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })
    // middlewares 

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access,1' });
      }
      const data = req.headers.authorization.split(' ');
      const token = data[1]
      jwt.verify(token, process.env.ACCRSS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access ,2' })
        }
        req.decoded = decoded;

        next();
      })
    }

// ...............................users...................................
app.put('/user',async (req,res)=>{
const user= req.body
const query = {email:user?.email}
const isExist = await userCollection.findOne(query)
if(isExist){
  if(user.status === 'Requested'){
    const result = await userCollection.updateOne(query,{
      $set:{status:user?.status}
    })
    return res.send(result)
  }else{
    return res.send(isExist)
  }
}
const options = {upsert:true}
const updateDoc={
  $set:{
    ...user, Timestamp:Date.now()
  }
}
const result = await userCollection.updateOne(query,updateDoc,options)
res.send(result)
})

    
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})