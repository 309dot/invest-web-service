/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import {collectPriceJob} from "./jobs/collectPrice";
import {collectNewsJob} from "./jobs/collectNews";
import {executeAutoInvestJob} from "./jobs/executeAutoInvest";
import * as logger from "firebase-functions/logger";

setGlobalOptions({maxInstances: 10});

// Export scheduled jobs
export {collectPriceJob, collectNewsJob, executeAutoInvestJob};

export const helloWorld = onRequest((request, response) => {
  logger.info("Health check 호출", {structuredData: true});
  response.json({
    ok: true,
    message: "MGK Cloud Functions is running",
    timestamp: new Date().toISOString(),
  });
});
