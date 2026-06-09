$ErrorActionPreference = "Continue"

# Parse .env.local and push variables to Vercel
$envFile = Get-Content -Path ".env.local"
foreach ($line in $envFile) {
    $line = $line.Trim()
    if ($line.StartsWith("#") -or $line -eq "") {
        continue
    }
    
    # Split on the first '='
    $idx = $line.IndexOf('=')
    if ($idx -lt 0) {
        continue
    }
    
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    
    # Strip quotes if present
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    
    Write-Host "Adding $key to Vercel..."
    
    # Add to production
    cmd /c "npx vercel env add $key production --value `"$value`" --yes --force"
    
    # Add to development
    cmd /c "npx vercel env add $key development --value `"$value`" --yes --force"
}
Write-Host "Environment variables pushed successfully!"
