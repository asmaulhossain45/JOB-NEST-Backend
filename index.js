const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// ----- Create Manual Middleware -----
const logger = async (req, res, next) => {
  console.log("Called: ", req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "forbidden" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // Error
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized" });
    }
    // If token is Valid then it will be decoded
    console.log("Value in the Token", decoded);
    req.user = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.flnzb5m.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ===== Collection List =====
const jobPostCollection = client.db("JobNest").collection("JobPosts");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Create Jwt Token
app.post("/api/jwt", async (req, res) => {
  const user = req.body;
  console.log(user);
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });
  res
    .cookie("Access token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    })
    .send({ success: true });
});

// ===== Load jobPost for Home Tab =====
app.get("/api/homeTab", async (req, res) => {
  let queryObj = {};
  const category = req.query.category;
  if (category) {
    queryObj.category = category;
  }

  try {
    const result = await jobPostCollection.find(queryObj).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send("Internal Server Error: " + error.message);
  }
});

// ===== Load All jobPost =====
app.get("/api/allJobPost", async (req, res) => {
  let queryObj = {};
  let sortObj = {};

  const title = req.query.title;
  const sortField = req.query.sortField;
  const sortOrder = req.query.sortOrder;

  //   Pagination
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const skip = (page - 1) * limit;

  if (title) {
    queryObj.title = title;
  }

  if (sortField && sortOrder) {
    sortObj[sortField] = sortOrder;
  }

  try {
    const result = await jobPostCollection
      .find(queryObj)
      .skip(skip)
      .limit(limit)
      .sort(sortObj)
      .toArray();
    const jobPostCount = await jobPostCollection.countDocuments();
    res.send({ jobPostCount, result });
  } catch (error) {
    res.status(500).send("Internal Server Error: " + error.message);
  }
});

// view Details
app.get("/api/details/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await jobPostCollection.findOne(query);
  res.send(result);
});

// Update Applications Number
app.patch("/api/details/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true };
  const updatedPost = {
    $inc: {
      JobApplicantsNumber: 1,
    },
  };
  const result = await jobPostCollection.updateOne(
    filter,
    updatedPost,
    options
  );
  res.send(result);
});

// ===== Server Testing =====
app.get("/", (req, res) => {
  res.send("Server Running........");
});

app.listen(port, () => {
  console.log(`Server listening on port: ${port}`);
});