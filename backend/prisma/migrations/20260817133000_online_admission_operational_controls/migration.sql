CREATE UNIQUE INDEX "OnlineAdmissionSubmission_active_email_offering_key"
ON "OnlineAdmissionSubmission" ("programOfferingId", lower("applicantEmail"))
WHERE "status" NOT IN ('REJECTED', 'WITHDRAWN');
