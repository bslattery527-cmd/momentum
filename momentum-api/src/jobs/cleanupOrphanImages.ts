import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { deleteS3Objects } from '../services/imageService.js';

/**
 * Nightly cleanup job that purges orphaned image records.
 *
 * Orphaned images are LogImage records where:
 * - logId is null (pending upload, never committed to a log)
 * - Created more than 10 minutes ago
 *
 * These arise when a user requests pre-signed URLs but never
 * completes the log creation flow.
 */
export function startCleanupJob(): void {
  // Run every night at 3:00 AM UTC
  cron.schedule('0 3 * * *', async () => {
    console.log('[cleanup] Starting orphan image cleanup...');

    try {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      // Find orphaned images
      const orphans = await prisma.logImage.findMany({
        where: {
          logId: null,
          createdAt: { lt: cutoff },
        },
        select: {
          id: true,
          s3Key: true,
        },
      });

      if (orphans.length === 0) {
        console.log('[cleanup] No orphaned images found.');
        return;
      }

      console.log(`[cleanup] Found ${orphans.length} orphaned image(s). Cleaning up...`);

      // Delete S3 objects
      const s3Keys = orphans.map((o) => o.s3Key);
      await deleteS3Objects(s3Keys);

      // Delete database records
      await prisma.logImage.deleteMany({
        where: {
          id: { in: orphans.map((o) => o.id) },
        },
      });

      console.log(`[cleanup] Successfully cleaned up ${orphans.length} orphaned image(s).`);
    } catch (err) {
      console.error('[cleanup] Error during orphan image cleanup:', err);
    }
  });

  console.log('[cleanup] Orphan image cleanup job scheduled (3:00 AM UTC daily)');
}
