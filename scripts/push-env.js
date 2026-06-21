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
    
    // Write value to temporary file to avoid shell escaping issues
    fs.writeFileSync(tempFilePath, value, 'utf8');
    
    // Vercel CLI supports reading values from stdin using redirection like `< file.txt`
    const vercelCmd = process.platform === 'win32' ? 'npx.cmd vercel' : 'npx vercel';

    const shellCommandProd = process.platform === 'win32'
      ? `cmd.exe /c "${vercelCmd} env add ${key} production --yes --force < _temp_env_val.txt"`
      : `"${vercelCmd}" env add ${key} production --yes --force < _temp_env_val.txt`;
      
    const shellCommandDev = process.platform === 'win32'
      ? `cmd.exe /c "${vercelCmd} env add ${key} development --yes --force < _temp_env_val.txt"`
      : `"${vercelCmd}" env add ${key} development --yes --force < _temp_env_val.txt`;

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
  }

  // Clean up
  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
  }
  console.log('\nAll environment variables processed successfully!');
} catch (err) {
  console.error('Error executing script:', err);
}
