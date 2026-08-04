import 'dotenv/config';
import { validateReleaseEnv } from './env-validation';

validateReleaseEnv();
process.stdout.write('Production environment validation passed.\n');
