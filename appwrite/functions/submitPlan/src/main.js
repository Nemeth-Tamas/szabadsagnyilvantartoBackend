import { Client, Databases, ID, Query, Users } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client();

  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const plansID = process.env.APPWRITE_PLANS_COLLECTION;

  // Validate the environment variables
  if (!dbId || !plansID) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);

  let submittingId;
  let submittingUser;
  let plan;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId || !body.plan) {
      throw new Error("submittingId|plan is missing in the request body.");
    }
    submittingId = body.submittingId;
    plan = body.plan;

    submittingUser = await users.get(submittingId);
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }

  try {
    let filledOut = true;

    if (plan.length == 0) {
      return res.json({ status: "fail", error: "Plan is empty.", errorCode: "emptyPlan" });
    }

    if (submittingUser.prefs.maxdays == 0) {
      return res.json({ status: "fail", error: "HR did not set the number of days yet", errorCode: "noDaysSet" });
    } else if (submittingUser.prefs.maxdays == plan.length) {
      filledOut = true;
      let doc = (await database.listDocuments(dbId, plansID, [
        Query.equal("userId", submittingId)
      ]))?.documents[0];

      if (doc == undefined) {
        let planDoc = await database.createDocument(dbId, plansID, ID.unique(), {
          userId: submittingId,
          managerId: submittingUser.prefs.manager,
          dates: plan,
          filledOut: filledOut
        });
        return res.json({ status: "success", planDoc });
      } else {
        if (doc.filledOut) {
          return res.json({ status: "fail", error: "Plan already filled out", errorCode: "planFilledOut" });
        } else {
          let docId = doc.$id;
          let planDoc = await database.updateDocument(dbId, plansID, docId, {
            dates: plan,
            filledOut: filledOut
          });
          return res.json({ status: "success", planDoc });
        }
      }
    } else if (submittingUser.prefs.maxdays > plan.length) {
      return res.json({ status: "fail", error: "Did not use all days", errorCode: "notAllDaysUsed" });
    } else if (submittingUser.prefs.maxdays < plan.length) {
      return res.json({ status: "fail", error: "Used more days than allowed", errorCode: "tooManyDaysUsed" });
    }
  } catch (err) {
    error(`Failed to submit plan: ${err.message}`);
    return res.json({ status: "fail", error: "Failed to submit plan" });
  }
};
