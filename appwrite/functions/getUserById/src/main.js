import { Client, Databases, Query, Users } from 'node-appwrite';

const isSick = (tappenz) => {
  if (tappenz != undefined && (tappenz.endDate == null || new Date() < new Date(tappenz.endDate)) && new Date(tappenz.startDate) < new Date()) {
    return true;
  } else {
    return false;
  }
};

const isOnLeave = async (szabadsagok) => {
  if (szabadsagok != undefined) {
      let today = new Date();
      today = today.toISOString().split('T')[0]; // get date in YYYY-MM-DD format

      return szabadsagok.some(leave => leave.dates.includes(today));
  } else {
      return false;
  }
}

async function checkStatus(user, database, dbId, tappenzID, szabadsagID) {
  let tappenz = (await database.listDocuments(
    dbId, tappenzID, [
      Query.equal("userId", user.$id),
      Query.orderDesc("startDate")
    ]
  )).documents[0];
  user.prefs.sick = isSick(tappenz);
  let szabadsagok = (await database.listDocuments(
    dbId, szabadsagID, [
      Query.equal("userId", user.$id),
      Query.limit(1000)
    ]
  )).documents;
  user.prefs.onLeave = await isOnLeave(szabadsagok);
  return user;
}

// This is your Appwrite function
// It's executed each time we get a request
export default async ({ req, res, log, error }) => {
  const client = new Client();

  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const kerelmekId = process.env.APPWRITE_KERELMEK_COLLECTION;
  const szabadsagID = process.env.APPWRITE_SZABADSAG_COLLECTION;
  const plansID = process.env.APPWRITE_PLANS_COLLECTION;
  const tappenzID = process.env.APPWRITE_TAPPENZ_COLLECTION;

  // Validate the environment variables
  if (!dbId || !plansID || !kerelmekId || !szabadsagID || !tappenzID) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);

  let submittingId;
  let submittingUser;
  let userId;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId || !body.userId) {
      throw new Error("submittingId|userId is missing in the request body.");
    }
    submittingId = body.submittingId;
    userId = body.userId;

    submittingUser = await users.get(submittingId);
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }
  
  try {
    if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
      let user = await users.get(userId);
      if (user.email.endsWith(submittingUser.email.split("@")[1])) {
        user = await checkStatus(user, database, dbId, tappenzID, szabadsagID);
        return res.json({ status: "success", user });
      } else {
        return res.json({ status: "fail", error: "You are not allowed to view this user's data." });
      } 
    } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
      let user = await users.get(userId);
      if (user.email.endsWith(submittingUser.email.split("@")[1]) && user.prefs.manager.includes(submittingId)) {
        user = await checkStatus(user, database, dbId, tappenzID, szabadsagID);
        return res.json({ status: "success", user });
      } else {
        return res.json({ status: "fail", error: "You are not allowed to view this user's data." });
      }
    } else {
      return res.json({ status: "fail", error: "You are not allowed to view this user's data." });
    }
  } catch (err) {
    error(`Failed to get user data: ${err.message}`);
    return res.json({ status: "fail", err: "Failed to get user data" });
  }
};
