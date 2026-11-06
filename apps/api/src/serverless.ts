import 'reflect-metadata';
import express, { Express, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

// Vercel serverless entry point. The Nest app is created once per
// function instance and reused across invocations.
let server: Promise<Express> | undefined;

async function createServer(): Promise<Express> {
  const instance = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(instance), {
    logger: ['error', 'warn'],
  });
  configureApp(app);
  await app.init();
  return instance;
}

export default async function handler(req: Request, res: Response) {
  server ??= createServer();
  const app = await server;
  app(req, res);
}
