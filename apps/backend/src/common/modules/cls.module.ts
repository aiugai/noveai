import { Module } from '@nestjs/common'
import { ClsModule } from 'nestjs-cls'

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      // Explicitly disable automatic middleware mounting to avoid wildcard route '*'
      middleware: { mount: false },
      // The middleware is now manually applied in AppModule
    }),
  ],
  exports: [ClsModule],
})
export class ClsConfigModule {}
