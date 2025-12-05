import './register-paths'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe, BadRequestException, INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { setupSwagger } from './swagger/swagger.config'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'


async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const configService = app.get(ConfigService)
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER)
  app.useLogger(logger)

  setupCors(app, configService)

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: errors => new BadRequestException(errors),
    }),
  )

  app.setGlobalPrefix(configService.get<string>('app.apiPrefix', 'api/v1'))

  setupSwagger(app)

  const port = configService.get<number>('app.port', 3005)
  await app.listen(port)
}

bootstrap()

function setupCors(app: INestApplication, _configService: ConfigService) {
  const methods = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
  const headers = 'Content-Type, Authorization, X-Requested-With'

  app.enableCors({
    origin: true, // 反射请求来源，允许所有跨域
    credentials: true,
    methods,
    allowedHeaders: headers,
  })
}
