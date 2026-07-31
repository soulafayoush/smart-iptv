#!/bin/bash
# سكريبت التبديل بين SQLite (تطوير محلي) و PostgreSQL (إنتاج Firebase)

MODE=${1:-sqlite}
PRISMA_DIR="prisma"

if [ "$MODE" = "postgres" ]; then
  echo "🔄 التبديل إلى PostgreSQL..."
  cp "$PRISMA_DIR/schema.postgresql.prisma" "$PRISMA_DIR/schema.prisma"
  echo "✅ تم التبديل. قاعدة البيانات الآن: PostgreSQL"
  echo "   ضع DATABASE_URL في .env"
  echo "   ثم شغّل: npx prisma db push"
elif [ "$MODE" = "sqlite" ]; then
  echo "🔄 التبديل إلى SQLite..."
  # إعادة كتابة ملف SQLite schema
  cat > "$PRISMA_DIR/schema.prisma" << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           Int        @id @default(autoincrement())
  name         String
  email        String     @unique
  passwordHash String     @map("password_hash")
  role         String     @default("user")
  createdAt    DateTime   @default(now()) @map("created_at")
  watchHistory WatchHistory[]
  ratings      Rating[]
  favorites    Favorite[]

  @@map("Users")
}

model Channel {
  id          Int        @id @default(autoincrement())
  title       String
  category    String
  tags        String     @default("")
  thumbnailUrl String     @default("") @map("thumbnail_url")
  streamUrl   String     @default("") @map("stream_url")
  createdAt   DateTime   @default(now()) @map("created_at")
  watchHistory WatchHistory[]
  ratings      Rating[]
  favorites    Favorite[]

  @@map("Channels")
}

model WatchHistory {
  id            Int      @id @default(autoincrement())
  userId        Int      @map("user_id")
  channelId     Int      @map("channel_id")
  watchedAt     DateTime @default(now()) @map("watched_at")
  watchDuration Int      @default(0) @map("watch_duration")
  user          User     @relation(fields: [userId], references: [id])
  channel       Channel  @relation(fields: [channelId], references: [id])

  @@map("Watch_History")
}

model Server {
  id          Int    @id @default(autoincrement())
  serverName  String @map("server_name")
  ipAddress   String @map("ip_address")
  region      String @default("")
  currentLoad Float  @default(0) @map("current_load")
  status      String @default("active")

  @@map("Servers")
}

model Rating {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  channelId Int      @map("channel_id")
  score     Int
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id])
  channel   Channel @relation(fields: [channelId], references: [id])

  @@unique([userId, channelId])
  @@map("Ratings")
}

model Favorite {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  channelId Int      @map("channel_id")
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id])
  channel   Channel @relation(fields: [channelId], references: [id])

  @@unique([userId, channelId])
  @@map("Favorites")
}
EOF
  echo "✅ تم التبديل. قاعدة البيانات الآن: SQLite"
else
  echo "الاستخدام: ./switch-db.sh [sqlite|postgres]"
fi
