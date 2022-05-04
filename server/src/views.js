const uuid = require('uuid');
const express = require('express');

const prisma = require('./prisma');
const {
    sizeFormat,
    authorizeUser,
    mustBeAuthorizedView,
    mustNotBeAuthroizedView,
} = require('./utils');

const router = express.Router();
router.use(express.static('static'));

const getIconName = (osName) => {
    const icons = {
        'arch linux': 'arch',
        'ubuntu': 'ubuntu',
    };

    return icons[osName?.toLowerCase()] ?? 'unknown';
};

const ifUnknown = (value, trueValue, falseValue) => {
    return value === "unknown" ? trueValue : falseValue;
};

const getMonitoringData = async (req) => {
    const monitoringData = await prisma.monitoringData.findMany({ orderBy: { createdAt: 'desc' } });
    return monitoringData
        .filter(data => req.user || data.createdAt.toISOString() !== data.updatedAt.toISOString())
        .map(data => (
            data.createdAt.toISOString() === data.updatedAt.toISOString() ?
            {
                id: data.id,
                no_data: true,
                secret: req.user && data.secret,
            } :
            {
                secret: req.user && data.secret,
                icon_name: getIconName(data.HOST_OS_NAME),
                online: (data.updatedAt.getTime() + (+data.MONITOR_INTERVAL * 1000 * 1.3)) >= new Date().getTime(),
                hostname: data.HOST_NAME,
                public_ip: data.HOST_PUBLIC_IP,
                os_name: data.HOST_OS_NAME,
                os_version: ifUnknown(data.HOST_OS_VERSION, data.SYSTEM_KERNEL_VERSION, data.HOST_OS_VERSION),
                cpu_name: `${data.SYSTEM_CPU_MODEL}`,
                cpu_count: data.SYSTEM_CPU_LOGICAL_CPU_COUNT,
                ram_total: ifUnknown(data.SYSTEM_TOTAL_RAM, "unknown", sizeFormat(data.SYSTEM_TOTAL_RAM)),
                ram_used: ((((+data.SYSTEM_TOTAL_RAM - +data.SYSTEM_FREE_RAM) / +data.SYSTEM_TOTAL_RAM) * 100) || 0).toFixed(0),
                swap_total: ifUnknown(data.SYSTEM_TOTAL_SWAP, "unknown", sizeFormat(data.SYSTEM_TOTAL_SWAP)),
                swap_used: ((((+data.SYSTEM_TOTAL_SWAP - +data.SYSTEM_FREE_SWAP) / +data.SYSTEM_TOTAL_SWAP) * 100) || 0).toFixed(0),
                disk_total: sizeFormat(+data.DISK_AVAIL + +data.DISK_USED),
                disk_used: ((+data.DISK_USED / (+data.DISK_USED + +data.DISK_AVAIL)) * 100).toFixed(0),
                disk_warning: ((+data.DISK_USED / (+data.DISK_USED + +data.DISK_AVAIL)) * 100) > 80,
            }
        )
    );
}

router.get('/', mustBeAuthorizedView(async (req, res) =>  {
    res.locals.monitoringData = await getMonitoringData(req);
    res.render('home');
}));

router.get('/public', async (req, res) => {
    const basicAuth = 'Basic ' + Buffer.from(`${process.env.HOTHOST_WEB_BASIC_PUBLIC_USERNAME}:${process.env.HOTHOST_WEB_BASIC_PUBLIC_PASSWORD}`).toString('base64');
    if (req.headers['authorization'] !== basicAuth) {
        res.statusCode = 401;
        res.header('WWW-Authenticate', 'Basic realm="restricted"');
        res.end();
    } else {
        res.locals.monitoringData = await getMonitoringData(req);
        res.render('home');
    }
});

router.get('/login/', mustNotBeAuthroizedView((req, res) => res.render('login')));
router.post('/login/', mustNotBeAuthroizedView(async (req, res) => {
    try {
        const { username, password } = req.fields;
        if (username && password) {
            const jwtToken = await authorizeUser(username, password);
            res.cookie('__hhjwt', jwtToken, {
                maxAge: 60 * 60 * 1000,
                sameSite: 'Strict', // prevents from broader class of CSRF attacks then even Lax, no need in external CSRF handlers for 92.16% of browsers
                secure: false, // some users might have non-SSL sites, probably should go from ENV var which gives greenlight
            });
            res.redirect(req.query.next || '/');
        }
    } catch (e) {
        res.locals.error = e.message;
        res.render('login');
    }
}));

router.get('/users/', mustBeAuthorizedView((req, res) => res.render('users')));
router.post('/users/', mustBeAuthorizedView((req, res) => {

}));
module.exports = router;