const path = require('path');
const express = require('express');

const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");

const viewRouter = require('./views');
const apiRouter = require('./api');

const { checkUserExistsOrCreate } = require('./utils');
const { authMiddleware } = require('./middleware');


if (process.env.ENV === 'local') {
  process.env.ADMIN_PASSWORD_HASH = 'e10adc3949ba59abbe56e057f20f883e';
  process.env.JWT_SECRET = 'e10adc3949ba59abbe56e057f20f883e';
}


async function main() {
  await checkUserExistsOrCreate();

  const app = express();
  const port = process.env.SERVER_PORT || 8007;

  app.set('view engine', 'html');
  app.engine('html', require('hbs').__express);
  app.set('views', path.join(path.dirname(__dirname), 'html'));

  app.use(cookieParser());
  app.use(bodyParser.json());

  app.use(authMiddleware);

  app.use('/', viewRouter);
  app.use('/api/', apiRouter);

  app.listen(port, '0.0.0.0', () => {
    console.log(`🔥🔥🔥 Hothost is listening on port ${port}`)
  });
}

main().catch(console.error);