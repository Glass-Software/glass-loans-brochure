/*
  Warnings:

  - Made the column `square_feet` on table `underwriting_submissions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `year_built` on table `underwriting_submissions` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "underwriting_submissions" ALTER COLUMN "square_feet" SET NOT NULL,
ALTER COLUMN "year_built" SET NOT NULL;
