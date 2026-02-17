$srcDir = "c:\Users\USER\Documents\trae_projects\red social\entropia\src"
$files = Get-ChildItem -Path $srcDir -Recurse -Include *.astro,*.tsx,*.ts,*.css

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    
    # Replace #1a5c40 with #22c55e
    $content = $content -replace '#1a5c40', '#22c55e'
    
    # Replace #0d3d2b (darker variant) with #15803d
    $content = $content -replace '#0d3d2b', '#15803d'
    
    # Replace #0f4c35 (medium variant) with #16a34a
    $content = $content -replace '#0f4c35', '#16a34a'
    
    # Replace #2d8a5e with #4ade80
    $content = $content -replace '#2d8a5e', '#4ade80'
    
    # Replace rgba(26, 92, 64, X) with rgba(34, 197, 94, X)
    $content = $content -replace 'rgba\(26,\s*92,\s*64,', 'rgba(34, 197, 94,'
    
    if ($content -ne $original) {
        Set-Content $file.FullName -Value $content -NoNewline
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "Done!"
