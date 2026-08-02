<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

# Base API

REST API built with NestJS and PostgreSQL using Drizzle ORM. Includes JWT authentication with Role-Based Access Control (RBAC).

## 🚀 Installation and Setup

### 1. Clone the project

```bash
git clone <repository-url>
cd nestjs-postgresql-base-project
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Configure environment variables

```bash
cp .env.template .env
```

Edit the `.env` file with your database credentials:

```env
DB_PASSWORD=MySecr3tPassWord@as2
DB_NAME=TesloDB
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres

PORT=3000
HOST_API=http://localhost:3000/api

JWT_SECRET=Est3EsMISE3Dsecreto32s
```

### 4. Start the database

```bash
docker-compose up -d
```

### 5. Generate and run Drizzle migrations

```bash
npm run db:generate
npm run db:migrate
```

### 6. Start the development server

```bash
yarn start:dev
```

### 7. Run the initial data seed

Access the following URL in your browser or using an HTTP client:

```
GET http://localhost:3000/api/seed
```

## 📚 API Documentation

Once the server is running, access the Swagger documentation at:

```
http://localhost:3000/api
```

## 🛠️ Available Scripts

### Development

```bash
yarn start:dev          # Start server with hot reload
yarn start:debug        # Start in debug mode
```

### Production

```bash
yarn build              # Build project
yarn start:prod         # Start in production
```

### Database

```bash
npm run db:generate     # Generate Drizzle migrations
npm run db:migrate      # Run migrations
npm run db:studio       # Open Drizzle Studio (visual UI)
```

### Testing

```bash
yarn test               # Run unit tests
yarn test:watch         # Run tests in watch mode
yarn test:cov           # Run tests with coverage
yarn test:e2e           # Run end-to-end tests
```

### Code Quality

```bash
yarn lint               # ESLint with auto-fix
yarn format             # Format with Prettier
```

## 🔐 Authentication

The project includes JWT authentication with the following endpoints:

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/check-status` - Check authentication status

## 👥 User Roles

- **ADMIN** - Full system access
- **USER** - Limited access

## 🗄️ Tech Stack

- **Framework:** NestJS
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Authentication:** JWT + Passport
- **Validation:** class-validator + class-transformer
- **Documentation:** Swagger/OpenAPI
