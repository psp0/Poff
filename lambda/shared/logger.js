/**
 * Structured Logger for Lambda Functions
 * Outputs logs in JSON format for better querying in CloudWatch Insights
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const LOG_LEVEL_NAMES = {
    0: 'DEBUG',
    1: 'INFO',
    2: 'WARN',
    3: 'ERROR'
};

class Logger {
    constructor(serviceName) {
        this.serviceName = serviceName || process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown-service';
        
        // Set log level based on environment
        const envLogLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG');
        this.minLevel = LOG_LEVELS[envLogLevel.toUpperCase()] || LOG_LEVELS.INFO;
    }

    _shouldLog(level) {
        return level >= this.minLevel;
    }

    _log(level, message, meta = {}) {
        if (!this._shouldLog(level)) {
            return;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level: LOG_LEVEL_NAMES[level],
            service: this.serviceName,
            message,
            requestId: process.env.AWS_LAMBDA_REQUEST_ID, // Available in Lambda context
            ...meta
        };

        // Use console.error for ERROR level to ensure it's picked up as an error by CloudWatch
        // Use console.log for others
        if (level === LOG_LEVELS.ERROR) {
            console.error(JSON.stringify(logEntry));
        } else {
            console.log(JSON.stringify(logEntry));
        }
    }

    debug(message, meta) {
        this._log(LOG_LEVELS.DEBUG, message, meta);
    }

    info(message, meta) {
        this._log(LOG_LEVELS.INFO, message, meta);
    }

    warn(message, meta) {
        this._log(LOG_LEVELS.WARN, message, meta);
    }

    error(message, errorOrMeta) {
        let meta = {};
        if (errorOrMeta instanceof Error) {
            meta = {
                error: {
                    name: errorOrMeta.name,
                    message: errorOrMeta.message,
                    stack: errorOrMeta.stack,
                    code: errorOrMeta.code
                }
            };
        } else if (typeof errorOrMeta === 'object') {
            meta = errorOrMeta;
        }
        this._log(LOG_LEVELS.ERROR, message, meta);
    }
}

// Default instance
const logger = new Logger();

module.exports = {
    Logger,
    logger,
    LOG_LEVELS
};
