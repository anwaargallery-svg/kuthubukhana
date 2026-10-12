Set WshShell = WScript.CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
Set oShellLink = WshShell.CreateShortcut(strDesktop & "\Kuthbukhana Library.lnk")

Dim fso
Set fso = CreateObject("Scripting.FileSystemObject")
strCurrentDir = fso.GetParentFolderName(WScript.ScriptFullName)

oShellLink.TargetPath = strCurrentDir & "\Start-Library-PC-App.bat"
oShellLink.WorkingDirectory = strCurrentDir
oShellLink.WindowStyle = 1
oShellLink.IconLocation = strCurrentDir & "\assets\images\app-icon.ico,0"
oShellLink.Description = "Kuthbukhana Anwariyya Library Management Desktop Application"
oShellLink.Save

WScript.Echo "Success! Desktop Shortcut updated with Library Logo Icon on your Desktop."
