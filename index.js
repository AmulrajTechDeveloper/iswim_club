const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
const uri = "mongodb+srv://karuppasamy17uh34_db_user:QrfBI0qbDQHPGgma@iswimclub.1psdw5e.mongodb.net/?appName=ISwimClub";
const client = new MongoClient(uri);

let db;
client.connect().then(() => {
  db = client.db("iswimclub");
  console.log("Connected to MongoDB");
});

// Register Admin
app.post("/api/admin/register", async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) return res.status(400).json({ message: "Missing fields" });

    const admins = db.collection("admins");
    const existing = await admins.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const newAdmin = { name, email, phone, password: phone };
    await admins.insertOne(newAdmin);
    res.json({ message: "Register completed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login Admin
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const admins = db.collection("admins");
    const admin = await admins.findOne({ email, password });
    if (!admin) return res.status(400).json({ message: "Invalid login" });

    res.json({
      success: true,
      admin: { id: admin._id, name: admin.name, email: admin.email },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// -------------------------------------------------------------
// 🧾 CLIENT REGISTER
// -------------------------------------------------------------
app.post("/api/clients/register", async (req, res) => {
  try {
    const data = req.body;

    // Basic validation
    if (
      !data.name ||
      !data.sex ||
      !data.dob ||
      !data.parentName ||
      !data.contactNumber
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const clientsCollection = db.collection("clients");
    const clientDetailsCollection = db.collection("clientDetails");

    // Summary (main client info)
    const summaryDoc = {
      name: data.name,
      sex: data.sex,
      dob: data.dob,
      parentName: data.parentName,
      contactNumber: data.contactNumber,
      email: data.email || null,
      addedByName: data.addedByName || null,
      addedByEmail: data.addedByEmail || null,
      createdAt: new Date(),
    };

    // Insert into main clients collection
    const insertResult = await clientsCollection.insertOne(summaryDoc);
    const clientId = insertResult.insertedId;

    // Detailed info
    const detailsDoc = {
      clientId: clientId,
      name: data.name,
      sex: data.sex,
      dob: data.dob,
      parentName: data.parentName,
      contactNumber: data.contactNumber,
      email: data.email || null,
      medical: {
        bloodGroup: data.bloodGroup || "",
        allergies: data.allergies || "",
        pediatrician: data.pediatrician || "",
        pediatricianContact: data.pediatricianContact || "",
        emergencyContacts: data.emergencyContacts || "",
        otherInfo: data.otherInfo || "",
      },
      addedByName: data.addedByName || null,
      addedByEmail: data.addedByEmail || null,
      createdAt: new Date(),
    };

    // Insert into detailed collection
    await clientDetailsCollection.insertOne(detailsDoc);

    res.json({
      message: "Client registered successfully",
      clientId: clientId,
    });
  } catch (err) {
    console.error("Error saving client:", err);
    res.status(500).json({ message: "Error saving client: " + err.message });
  }
});

// -------------------------------------------------------------
// 📋 GET all clients
// -------------------------------------------------------------
app.get("/api/clients/list", async (req, res) => {
  try {
    const clients = db.collection("clients");
    const list = await clients
      .find({}, { projection: { name: 1, dob: 1, email: 1, contactNumber: 1, addedByName: 1 } })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ message: "Error loading clients: " + err.message });
  }
});

// Get single client by ID
app.get("/api/clients/details/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // Validate the ID
    if (!id) return res.status(400).json({ message: "Missing client ID" });

    const clientData = await db
      .collection("clientDetails")
      .findOne({ clientId: new ObjectId(id) });

    if (!clientData) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.json(clientData);
  } catch (err) {
    console.error("Error fetching client details:", err);
    res
      .status(500)
      .json({ message: "Error fetching client details: " + err.message });
  }
});

// -------------------------------------------------------------
// 📅 UPDATE client membership dates
// -------------------------------------------------------------
app.post("/api/clients/update-dates", async (req, res) => {
  try {
    const { clientId, _id, startDate, expiryDate } = req.body;
    const id = clientId || _id; // supports both field names

    console.log("Received:", req.body);

    if (!id || !startDate || !expiryDate)
      return res.status(400).json({ message: "Missing fields" });

    const result = await db.collection("clients").updateOne(
      { _id: new ObjectId(id) },
      { $set: { startDate, expiryDate, status: "Active" } }
    );

    if (result.modifiedCount === 0)
      return res.status(404).json({ message: "Client not found" });

    res.json({ success: true, message: "Client membership updated" });
  } catch (err) {
    console.error("Error updating client dates:", err);
    res.status(500).json({ message: "Error updating client dates: " + err.message });
  }
});

// 📘 Combined route to fetch both client info and membership data
// ✅ Fetch only membership date info (from 'clients' collection)
app.get("/api/clients/details-dates/:id", async (req, res) => {
  try {
    const id = req.params.id;
   console.log("Fetching membership data for client ID:", id);
   

    // 🧩 Validate ID
    if (!id) {
      return res.status(400).json({ message: "Missing client ID" });
    }

    // 🗂 Fetch client membership data
    const client = await db.collection("clients").findOne({
      _id: new ObjectId(id),
    });

    // ❌ No client found
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // ✅ Return only date-related fields
    res.json({
      success: true,
      clientId: client._id,
      name: client.name,
      startDate: client.startDate || null,
      expiryDate: client.expiryDate || null,
      status: client.status || "Inactive",
    });
  } catch (err) {
    console.error("Error fetching client membership data:", err);
    res.status(500).json({
      message: "Error fetching client membership data: " + err.message,
    });
  }
});

//karuppasamy17uh34@gmail.com
// 📩 Save new enquiry
app.post("/api/clients/enquiries/add", async (req, res) => {
  try {
    const { name, phone, message, adminName, adminEmail } = req.body;
    console.log("Received enquiry:", req.body);

    if (!name || !phone || !message || !adminName || !adminEmail) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newEnquiry = {
      name,
      phone,
      message,
      adminName,
      adminEmail,
      createdAt: new Date(),
    };

    const result = await db.collection("clientEnquiries").insertOne(newEnquiry);
    res.json({ success: true, message: "Enquiry saved successfully", id: result.insertedId });
  } catch (err) {
    console.error("Error saving enquiry:", err);
    res.status(500).json({ message: "Error saving enquiry: " + err.message });
  }
});

// 🟢 Fetch all enquiries
app.get("/api/clients/enquiries/all", async (req, res) => {
  try {
    const data = await db
      .collection("clientEnquiries")
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, data });
  } catch (err) {
    console.error("Error fetching enquiries:", err);
    res.status(500).json({ message: "Error fetching enquiries: " + err.message });
  }
});

// 🟢 Fetch all clients whose expiry date is near or expired
app.get("/api/clients/renewals", async (req, res) => {
  try {
    const today = new Date();
    const upcomingLimit = new Date();
    upcomingLimit.setDate(today.getDate() + 7); // Next 7 days window

    const clients = await db
      .collection("clients")
      .find({
        expiryDate: { $exists: true },
      })
      .toArray();

    // Filter in JS to categorize expiry
    const list = clients.filter(c => {
      if (!c.expiryDate) return false;
      const expiry = new Date(c.expiryDate);
      const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
      return diffDays <= 7; // expired, today, tomorrow, or within 7 days
    });

    res.json({ success: true, data: list });
  } catch (err) {
    console.error("Error fetching renewals:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


app.post("/api/clients/renew", async (req, res) => {
  try {
    const {
      clientId,
      startDate,
      expiryDate,
      paymentType,
      amount,
      adminName,
      adminEmail,
    } = req.body;

    if (!clientId || !startDate || !expiryDate)
      return res.status(400).json({
        success: false,
        message: "Missing required fields: clientId, startDate, expiryDate",
      });

    // Update client collection
    const result = await db.collection("clients").updateOne(
      { _id: new ObjectId(clientId) },
      {
        $set: {
          startDate,
          expiryDate,
          status: "Active",
          lastRenewedAt: new Date(),
        },
      }
    );

    // Fetch client for history record
    const client = await db
      .collection("clients")
      .findOne({ _id: new ObjectId(clientId) });

    if (!client) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    // Create renewal history record
    await db.collection("renewalHistory").insertOne({
      clientId,
      clientName: client.name || "",
      clientPhone: client.contactNumber || "",
      startDate,
      expiryDate,
      paymentType,
      amount,
      renewedBy: {
        adminName,
        adminEmail,
      },
      renewalDate: new Date().toISOString(),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: "Renewal updated successfully",
      updated: result.modifiedCount > 0,
    });
  } catch (err) {
    console.error("Error renewing client:", err);
    res.status(500).json({
      success: false,
      message: "Error renewing client: " + err.message,
    });
  }
});

// 📦 Renewal History Report Route
app.get("/api/reports/renewal-history", async (req, res) => {
  try {
    const { q } = req.query; // optional search
    const filter = {};

    if (q && q.trim() !== "") {
      const regex = new RegExp(q, "i");
      Object.assign(filter, {
        $or: [
          { clientName: regex },
          { clientPhone: regex },
          { "renewedBy.adminName": regex },
          { "renewedBy.adminEmail": regex },
        ],
      });
    }

    const history = await db
      .collection("renewalHistory")
      .find(filter)
      .sort({ renewalDate: -1 }) // newest first
      .toArray();

    res.json({ success: true, data: history });
  } catch (err) {
    console.error("Error fetching renewal reports:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});





app.get("/", (req, res) => {
  res.send("Server is running in vercel i swimclub");
});

app.listen(4000, () => console.log("Server running on port 4000"));
