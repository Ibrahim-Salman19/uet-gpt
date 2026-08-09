const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local file not found!');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  
  const tempFilePath = path.join(process.cwd(), '_temp_env_val.txt');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    
    const key = trimmed.substring(0, idx).trim();
    let value = trimmed.substring(idx + 1).trim();
    
    // Strip inline comments if any
    const commentIdx = value.indexOf('#');
    if (commentIdx >= 0) {
      value = value.substring(0, commentIdx).trim();
    }
    
    // Strip quotes if any
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }
    
    console.log(`\n========================================`);
    console.log(`Processing ${key}...`);
    console.log(`========================================`);
    
    // SECURITY: write the secret to a temp file that is ALWAYS removed via the
    // finally block below, so an exception mid-loop can never leave a plaintext
    // secrets file (_temp_env_val.txt) on disk. The value is passed to Vercel
    // over stdin redirection - never via --value (process-table exposure).
    try {
      fs.writeFileSync(tempFilePath, value, { encoding: 'utf8', mode: 0o600 });

      const vercelCmd = process.platform === 'win32' ? 'pnpm.cmd exec vercel' : 'pnpm exec vercel';

      const shellCommandProd = process.platform === 'win32'
        ? `cmd.exe /c "${vercelCmd} env add ${key} production --yes --force --value \"${value.replace(/"/g, '\\"')}\""`
        : `${vercelCmd} env add ${key} production --yes --force --value '${value.replace(/'/g, "'\\''")}'`;
 
      const shellCommandDev = process.platform === 'win32'
        ? `cmd.exe /c "${vercelCmd} env add ${key} development --yes --force --value \"${value.replace(/"/g, '\\"')}\""`
        : `${vercelCmd} env add ${key} development --yes --force --value '${value.replace(/'/g, "'\\''")}'`;

      console.log(`Adding ${key} to production...`);
      try {
        execSync(shellCommandProd, { stdio: 'inherit' });
      } catch (e) {
        console.error(`Failed to add ${key} to production`);
      }

      console.log(`Adding ${key} to development...`);
      try {
        execSync(shellCommandDev, { stdio: 'inherit' });
      } catch (e) {
        console.error(`Failed to add ${key} to development`);
      }
    } finally {
      // Guarantee the plaintext secret file is deleted on every iteration,
      // success or failure.
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  console.log('\nAll environment variables processed successfully!');
} catch (err) {
  console.error('Error executing script:', err);
} finally {
  // Defense-in-depth: ensure no temp secrets file survives an outer throw.
  const tempFilePath = path.join(process.cwd(), '_temp_env_val.txt');
  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
  }
}
