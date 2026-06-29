Add-Type -AssemblyName System.Drawing

$width = 1600
$height = 1080
$output = Join-Path $PSScriptRoot 'authentication-class-diagram.png'

$bmp = [System.Drawing.Bitmap]::new($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.Clear([System.Drawing.Color]::White)

$fontTitle = [System.Drawing.Font]::new('Arial', 23, [System.Drawing.FontStyle]::Bold)
$fontSub = [System.Drawing.Font]::new('Arial', 15)
$fontHead = [System.Drawing.Font]::new('Arial', 15, [System.Drawing.FontStyle]::Bold)
$fontBody = [System.Drawing.Font]::new('Arial', 12)
$fontLabel = [System.Drawing.Font]::new('Arial', 12, [System.Drawing.FontStyle]::Bold)
$ink = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(23, 32, 51))
$muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(92, 102, 122))
$center = [System.Drawing.StringFormat]::new()
$center.Alignment = [System.Drawing.StringAlignment]::Center
$near = [System.Drawing.StringFormat]::new()
$near.Alignment = [System.Drawing.StringAlignment]::Near

$gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(18, 20, 30, 45), 1)
for ($x = 0; $x -lt $width; $x += 28) { $g.DrawLine($gridPen, $x, 0, $x, $height) }
for ($y = 0; $y -lt $height; $y += 28) { $g.DrawLine($gridPen, 0, $y, $width, $y) }

$g.DrawString('Diagramme de classes d objet - Authentification PromoLink', $fontTitle, $ink, [System.Drawing.RectangleF]::new(0, 28, $width, 42), $center)
$g.DrawString('Connexion classique et connexion Google, conforme au backend Spring Boot', $fontSub, $muted, [System.Drawing.RectangleF]::new(0, 72, $width, 28), $center)

function Draw-Box {
    param($x, $y, $w, $h, $title, [string[]]$lines, $fill, $border)

    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $r = 8
    $path.AddArc($x, $y, $r * 2, $r * 2, 180, 90)
    $path.AddArc($x + $w - $r * 2, $y, $r * 2, $r * 2, 270, 90)
    $path.AddArc($x + $w - $r * 2, $y + $h - $r * 2, $r * 2, $r * 2, 0, 90)
    $path.AddArc($x, $y + $h - $r * 2, $r * 2, $r * 2, 90, 90)
    $path.CloseFigure()

    $script:g.FillPath([System.Drawing.SolidBrush]::new($fill), $path)
    $script:g.DrawPath([System.Drawing.Pen]::new($border, 3), $path)
    $script:g.DrawLine([System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(60, 23, 32, 51), 2), $x, $y + 54, $x + $w, $y + 54)
    $script:g.DrawString($title, $script:fontHead, $script:ink, [System.Drawing.RectangleF]::new($x + 8, $y + 7, $w - 16, 46), $script:center)
    $script:g.DrawString(($lines -join "`n"), $script:fontBody, $script:ink, [System.Drawing.RectangleF]::new($x + 16, $y + 64, $w - 28, $h - 66), $script:near)
}

function Draw-Arrow {
    param($x1, $y1, $x2, $y2, $label, $lx, $ly, [bool]$dash = $false)

    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(82, 96, 112), 3)
    if ($dash) { $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash }
    $pen.CustomEndCap = [System.Drawing.Drawing2D.AdjustableArrowCap]::new(6, 8, $true)
    $script:g.DrawLine($pen, $x1, $y1, $x2, $y2)
    if ($label) { $script:g.DrawString($label, $script:fontLabel, $script:ink, $lx, $ly) }
}

$blue = [System.Drawing.Color]::FromArgb(232, 241, 255)
$blueB = [System.Drawing.Color]::FromArgb(91, 143, 214)
$green = [System.Drawing.Color]::FromArgb(232, 247, 239)
$greenB = [System.Drawing.Color]::FromArgb(79, 155, 104)
$orange = [System.Drawing.Color]::FromArgb(255, 241, 223)
$orangeB = [System.Drawing.Color]::FromArgb(214, 147, 60)
$pink = [System.Drawing.Color]::FromArgb(255, 233, 239)
$pinkB = [System.Drawing.Color]::FromArgb(215, 106, 137)
$gray = [System.Drawing.Color]::FromArgb(244, 246, 248)
$grayB = [System.Drawing.Color]::FromArgb(140, 152, 168)

Draw-Box 55 165 285 185 "<<boundary>>`nInterfaces Login" @('IHM Login', '+ saisirEmail()', '+ saisirMotDePasse()', '+ afficherErreur()', '+ ouvrirEspace()') $blue $blueB
Draw-Box 55 410 285 155 "<<boundary>>`nInterface Google" @('IHM Google', '+ cliquerGoogle()', '+ recevoirCode()', '+ connexionReussie()') $blue $blueB

Draw-Box 420 205 330 260 "<<controllers>>`nControleurs" @('AuthController', '+ login(request)', '+ adminLogin(request)', '+ platformAdminLogin(request)', '+ googleAuthorizationUrl(state)', '+ googleCallback(request)') $green $greenB

Draw-Box 840 145 385 445 "<<services>>`nServices metier et securite" @('AuthServiceImpl', '+ verifier email et mot de passe', '+ verifier role et compte actif', '', 'OAuth2ServiceImpl', '+ traiter la connexion Google', '+ chercher ou creer utilisateur', '', 'JwtService', '+ generer token JWT') $orange $orangeB

Draw-Box 1280 165 280 500 "<<donnees>>`nRepository et tables" @('UserRepository', '+ chercher utilisateur', '+ enregistrer utilisateur', '', 'Table PostgreSQL : users', '- id, fullName, email', '- password, role, active', '- oauthProvider, oauthId', '', 'Entity : User', 'CLIENT / ADMIN / PLATFORM_ADMIN') $pink $pinkB

Draw-Box 455 675 360 180 "<<dto>>`nObjets echanges" @('LoginRequest : email, password', 'OAuth2CallbackRequest : code, state', 'AuthResponse : token, email, role') $gray $grayB

Draw-Arrow 340 250 420 285 'identifiants' 347 225
Draw-Arrow 340 470 420 385 'code Google' 350 420
Draw-Arrow 750 315 840 315 'appelle' 770 290
Draw-Arrow 1225 330 1280 330 '' 0 0
Draw-Arrow 1032 590 760 675 'token JWT' 905 635 $true
Draw-Arrow 455 755 240 565 'reponse : token + role' 255 640 $true

$noteRect = [System.Drawing.Rectangle]::new(380, 910, 850, 95)
$notePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(125, 135, 148), 2)
$notePen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$g.FillRectangle([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 255, 255, 255)), $noteRect)
$g.DrawRectangle($notePen, $noteRect)
$note = 'Endpoints representes : /api/auth/login, /api/auth/admin/login, /api/auth/platform-admin/login, /api/auth/oauth2/google/url, /api/auth/oauth2/google/callback.'
$g.DrawString($note, $fontBody, $ink, [System.Drawing.RectangleF]::new(405, 930, 800, 58), $center)

$stream = [System.IO.File]::Open($output, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$bmp.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
$stream.Close()
$g.Dispose()
$bmp.Dispose()

Write-Host "Generated $output"
