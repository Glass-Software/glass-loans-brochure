import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";

async function checkDatabase() {
  try {
    const userCount = await prisma.user.count();
    const submissionCount = await prisma.underwritingSubmission.count();

    console.log(`Users: ${userCount}`);
    console.log(`Submissions: ${submissionCount}`);

    if (userCount > 0) {
      const sampleUser = await prisma.user.findFirst();
      console.log(`Sample user: ${sampleUser?.email}`);
    }

    if (submissionCount > 0) {
      const sampleSubmission = await prisma.underwritingSubmission.findFirst({
        select: {
          id: true,
          propertyAddress: true,
          propertyComps: true,
        }
      });
      console.log(`Sample submission: ${sampleSubmission?.propertyAddress}`);
      console.log(`Has propertyComps: ${!!sampleSubmission?.propertyComps}`);
    }
  } catch (error) {
    console.error("Error checking database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
