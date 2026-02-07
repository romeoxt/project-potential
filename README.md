### getting it running

install deps:

```
cd server && npm install
cd ../client && npm install
```

create a postgres db and run the schema against it, mongo just needs to be running:

```
createdb book_collection
psql -d book_collection -f server/sql/schema.sql
psql -d book_collection -f server/sql/seed.sql
```

seed.sql sets up an admin user and default collection.

add a .env in the server folder:

```
DATABASE_URL=postgres://user:password@localhost:5432/book_collection
MONGO_URL=mongodb://localhost:27017/book_collection
SESSION_SECRET=
PORT=3000
```

PORT defaults to 3000 if you dont set it.

seed some books so the list isnt empty:

```
cd server && npm run seed:books
```

then run:

```
cd server && npm run dev
cd client && npm run dev
```

vite proxies /api to express so it all works in dev.

for production just do npm run build in client/ then run the server, it serves the react build from client/dist.

### scripts

server:
- npm run dev starts with nodemon
- npm start plain node
- npm run seed:admin creates admin user, or pass username + password as args
- npm run seed:books generates random books with faker, pass a count if you want more than 15

client:
- npm run dev vite dev server
- npm run build production build

### layout

- api is under /api/*
- admin ui is at /admin, needs admin session
- react app handles everything else
- books in mongo, users + collections + sessions in postgres
