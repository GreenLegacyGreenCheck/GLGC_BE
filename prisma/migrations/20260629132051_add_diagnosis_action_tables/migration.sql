-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "category" TEXT NOT NULL,
    "cause" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "costLabel" TEXT NOT NULL,
    "reductionRateMin" DOUBLE PRECISION NOT NULL,
    "reductionRateMax" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "electricityRatio" DOUBLE PRECISION NOT NULL,
    "gasRatio" DOUBLE PRECISION NOT NULL,
    "targetEmissionKg" DOUBLE PRECISION NOT NULL,
    "topFactors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendedAction" (
    "id" TEXT NOT NULL,
    "diagnosisId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "expectedMinKg" DOUBLE PRECISION NOT NULL,
    "expectedMaxKg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendedAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Action_code_key" ON "Action"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendedAction_diagnosisId_actionId_key" ON "RecommendedAction"("diagnosisId", "actionId");

-- AddForeignKey
ALTER TABLE "RecommendedAction" ADD CONSTRAINT "RecommendedAction_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendedAction" ADD CONSTRAINT "RecommendedAction_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
