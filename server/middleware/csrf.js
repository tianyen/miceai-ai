const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const HEADER_NAME = 'x-csrf-token';

function ensureSessionToken(req) {
    if (!req.session) {
        return null;
    }
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    return req.session.csrfToken;
}

function extractToken(req) {
    return req.body?._csrf ||
        req.query?._csrf ||
        req.headers?.[HEADER_NAME] ||
        req.headers?.['x-xsrf-token'] ||
        req.headers?.['csrf-token'];
}

function tokensEqual(a, b) {
    if (!a || !b) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function wantsJson(req) {
    return req.originalUrl.startsWith('/api/') ||
        req.headers['x-requested-with'] === 'XMLHttpRequest' ||
        req.headers.accept?.includes('json') ||
        req.headers['content-type']?.includes('application/json') ||
        (req.headers['sec-fetch-mode'] && req.headers['sec-fetch-mode'] !== 'navigate');
}

function respondCsrfError(req, res) {
    const message = 'Invalid or missing CSRF token';
    if (wantsJson(req)) {
        return res.status(403).json({
            success: false,
            error: {
                code: 'CSRF_TOKEN_INVALID',
                message
            }
        });
    }
    return res.status(403).render('errors/csrf', {
        layout: false,
        message
    });
}

function createCsrfMiddleware({ exposeTokenToView = false } = {}) {
    return function csrfMiddleware(req, res, next) {
        const sessionToken = ensureSessionToken(req);
        if (!sessionToken) {
            return respondCsrfError(req, res);
        }

        if (exposeTokenToView) {
            res.locals.csrfToken = sessionToken;
        }

        if (SAFE_METHODS.has(req.method)) {
            return next();
        }

        const incomingToken = extractToken(req);
        if (!tokensEqual(incomingToken, sessionToken)) {
            return respondCsrfError(req, res);
        }

        return next();
    };
}

module.exports = {
    adminViewCsrf: createCsrfMiddleware({ exposeTokenToView: true }),
    adminApiCsrf: createCsrfMiddleware()
};
