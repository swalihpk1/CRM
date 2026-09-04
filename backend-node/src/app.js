const express = require('express');
const cors = require('cors');
const { CORS_ORIGINS } = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const { router: authRouter } = require('./routes/auth');
const usersRouter = require('./routes/users');
const { router: contactsRouter } = require('./routes/contacts');
const notesRouter = require('./routes/notes');
const followupsRouter = require('./routes/followups');
const meetingsRouter = require('./routes/meetings');
const demosRouter = require('./routes/demos');
const activityLogsRouter = require('./routes/activityLogs');
const productivityRouter = require('./routes/productivity');
const miscRouter = require('./routes/misc');

const app = express();

// Matches Starlette's CORSMiddleware(allow_credentials=True,
// allow_origins=CORS_ORIGINS.split(','), allow_methods=['*'], allow_headers=['*']).
app.use(
  cors({
    origin: CORS_ORIGINS.includes('*') ? '*' : CORS_ORIGINS,
    credentials: true,
    methods: '*',
    allowedHeaders: '*',
  })
);

app.use(express.json({ limit: '10mb' }));

const apiRouter = express.Router();

// Registration order matters for path matching. Static-segment contact
// routes (import/preview/debug-data/count) are declared inside contactsRouter
// before its `/contacts/:contact_id` param route. demosRouter owns
// `/contacts/:contact_id/demos` and is mounted first per the plan.
apiRouter.use(demosRouter);
apiRouter.use(authRouter);
apiRouter.use(usersRouter);
apiRouter.use(contactsRouter);
apiRouter.use(notesRouter);
apiRouter.use(followupsRouter);
apiRouter.use(meetingsRouter);
apiRouter.use(activityLogsRouter);
apiRouter.use(productivityRouter);
apiRouter.use(miscRouter);

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
