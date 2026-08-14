-- CreateIndex
CREATE INDEX "notifications_userId_actorId_postId_type_idx" ON "notifications"("userId", "actorId", "postId", "type");
