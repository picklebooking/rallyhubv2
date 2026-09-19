import { existsSync } from "node:fs"

import { ValidationPipe, VersioningType } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"

async function bootstrap() {
  if (existsSync(".env")) {
    process.loadEnvFile(".env")
  }

  const app = await NestFactory.create(AppModule, { bodyParser: false })
  const corsOrigin = process.env.CORS_ORIGIN

  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(",").map((origin) => origin.trim()),
      credentials: true,
    })
  }

  app.enableVersioning({
    type: VersioningType.URI
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:true,
      transform: true
    }),
  )

  await app.listen(Number(process.env.PORT ?? 3000))
}
void bootstrap()
