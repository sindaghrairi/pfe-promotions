Add-Type -AssemblyName System.Drawing

$width = 1650
$height = 1040
$output = Join-Path $PSScriptRoot 'promolink-auth-object-class-diagram.png'

$bmp = [System.Drawing.Bitmap]::new($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.Clear([System.Drawing.Color]::White)

$fontTitle = [System.Drawing.Font]::new('Arial', 22, [System.Drawing.FontStyle]::Bold)
$fontHead = [System.Drawing.Font]::new('Arial', 13, [System.Drawing.FontStyle]::Bold)
$fontBody = [System.Drawing.Font]::new('Arial', 12)
$fontLabel = [System.Drawing.Font]::new('Arial', 11, [System.Drawing.FontStyle]::Bold)
$ink = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(20, 20, 20))
$center = [System.Drawing.StringFormat]::new()
$center.Alignment = [System.Drawing.StringAlignment]::Center
$near = [System.Drawing.StringFormat]::new()
$near.Alignment = [System.Drawing.StringAlignment]::Near
$pen = [System.Drawing.Pen]::new([System.Drawing.Color]::Black, 2)

$g.DrawString('Diagramme de classes d objet - Authentification PromoLink', $fontTitle, $ink, [System.Drawing.RectangleF]::new(0, 18, $width, 36), $center)

function Draw-ClassBox {
    param($x, $y, $w, $h, $stereotype, $name, [string[]]$attributes, [string[]]$methods)

    $script:g.DrawRectangle($script:pen, $x, $y, $w, $h)
    $script:g.DrawLine($script:pen, $x, $y + 70, $x + $w, $y + 70)
    $script:g.DrawLine($script:pen, $x, $y + 70 + [Math]::Max(70, $attributes.Count * 24 + 22), $x + $w, $y + 70 + [Math]::Max(70, $attributes.Count * 24 + 22))

    $script:g.DrawString("<<$stereotype>>", $script:fontBody, $script:ink, [System.Drawing.RectangleF]::new($x + 8, $y + 10, $w - 16, 20), $script:center)
    $script:g.DrawString($name, $script:fontHead, $script:ink, [System.Drawing.RectangleF]::new($x + 8, $y + 34, $w - 16, 28), $script:center)

    $attrText = if ($attributes.Count -gt 0) { $attributes -join "`n" } else { '' }
    $methodText = if ($methods.Count -gt 0) { $methods -join "`n" } else { '' }
    $attrHeight = [Math]::Max(70, $attributes.Count * 24 + 22)

    $script:g.DrawString($attrText, $script:fontBody, $script:ink, [System.Drawing.RectangleF]::new($x + 12, $y + 84, $w - 24, $attrHeight - 14), $script:near)
    $script:g.DrawString($methodText, $script:fontBody, $script:ink, [System.Drawing.RectangleF]::new($x + 12, $y + 84 + $attrHeight, $w - 24, $h - 84 - $attrHeight), $script:near)
}

function Draw-Arrow {
    param($x1, $y1, $x2, $y2, $label, $lx, $ly, [bool]$dash = $true)

    $p = [System.Drawing.Pen]::new([System.Drawing.Color]::Black, 2)
    if ($dash) { $p.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash }
    $p.CustomEndCap = [System.Drawing.Drawing2D.AdjustableArrowCap]::new(5, 7, $true)
    $script:g.DrawLine($p, $x1, $y1, $x2, $y2)
    if ($label) { $script:g.DrawString($label, $script:fontLabel, $script:ink, $lx, $ly) }
}

Draw-ClassBox 35 95 335 330 'boundary' 'InterfaceAuthentification' @(
    '- email : String',
    '- motDePasse : String',
    '- messageErreur : String'
) @(
    '+ afficherFormulaireConnexion()',
    '+ envoyerIdentifiants()',
    '+ loginWithGoogle()',
    '+ afficherMessageErreur()',
    '+ redirigerSelonRole()'
)

Draw-ClassBox 480 150 315 330 'control' 'AuthController' @(
    '- authService : AuthService',
    '- oAuth2Service : OAuth2Service'
) @(
    '+ login(request) : AuthResponse',
    '+ adminLogin(request) : AuthResponse',
    '+ platformAdminLogin(request) : AuthResponse',
    '+ googleAuthorizationUrl(state)',
    '+ googleCallback(request) : AuthResponse'
)

Draw-ClassBox 890 120 390 410 'services' 'ServicesAuthentification' @(
    'AuthServiceImpl',
    '- userRepository : UserRepository',
    '- jwtService : JwtService',
    '',
    'OAuth2ServiceImpl',
    '- userRepository : UserRepository',
    '- jwtService : JwtService'
) @(
    '+ login(request) : AuthResponse',
    '+ adminLogin(request) : AuthResponse',
    '+ platformAdminLogin(request) : AuthResponse',
    '+ handleGoogleCallback(code,state)'
)

Draw-ClassBox 1370 160 260 310 'repository' 'UserRepository' @() @(
    '+ findByEmailIgnoreCase(email)',
    '+ findByOauthProviderAndOauthId(...)',
    '+ existsByEmailIgnoreCase(email)',
    '+ save(user) : User'
)

Draw-ClassBox 890 590 390 260 'entity' 'User' @(
    '- id : Long',
    '- fullName : String',
    '- email : String',
    '- password : String',
    '- role : Role',
    '- active : Boolean',
    '- oauthProvider : OAuthProvider',
    '- oauthId : String',
    '- localPasswordSet : Boolean'
) @()

Draw-Arrow 370 250 480 250 '<<call>>' 400 218
Draw-Arrow 795 260 890 260 '<<use>>' 818 230
Draw-Arrow 1280 260 1370 260 '<<use>>' 1305 230
Draw-Arrow 1085 530 1085 590 '<<use>>' 1100 552
Draw-Arrow 890 610 370 425 'resultat : token JWT / erreur' 500 520

$legendX = 35
$legendY = 835
$g.DrawRectangle($pen, $legendX, $legendY, 720, 155)
Draw-Arrow ($legendX + 35) ($legendY + 35) ($legendX + 105) ($legendY + 35) 'call/use : appel ou utilisation entre objets' ($legendX + 130) ($legendY + 23)
$g.DrawString('Diagramme adapte aux classes reelles de PromoLink : AuthController, AuthServiceImpl, OAuth2ServiceImpl, UserRepository et User.', $fontBody, $ink, [System.Drawing.RectangleF]::new($legendX + 25, $legendY + 62, 660, 70), $near)

$stream = [System.IO.File]::Open($output, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$bmp.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
$stream.Close()
$g.Dispose()
$bmp.Dispose()

Write-Host "Generated $output"
