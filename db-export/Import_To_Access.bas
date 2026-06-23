Attribute VB_Name = "BuildSchema"
' ---------------------------------------------------------------------------
'  SakthiHR — build the database structure in MS Access from the .sql file.
'  1. Put SakthiHR_Access_Schema.sql in the SAME folder as this Access DB.
'  2. Alt+F11 -> Insert -> Module -> paste this -> press F5 / run BuildSchema.
'  Comment lines (--) are stripped; statements are split on ';' and executed.
' ---------------------------------------------------------------------------
Option Compare Database
Option Explicit

Public Sub BuildSchema()
    Dim fso As Object, ts As Object
    Dim raw As String, cleaned As String, lines() As String, i As Long, ln As String
    Dim stmts() As String, s As String
    Dim okCount As Long, skipCount As Long
    Dim sqlPath As String

    sqlPath = CurrentProject.Path & "\SakthiHR_Access_Schema.sql"
    Set fso = CreateObject("Scripting.FileSystemObject")
    If Not fso.FileExists(sqlPath) Then
        MsgBox "Not found: " & sqlPath, vbCritical
        Exit Sub
    End If
    Set ts = fso.OpenTextFile(sqlPath, 1)
    raw = ts.ReadAll
    ts.Close

    ' strip comment lines so they don't merge into the first statement
    raw = Replace(raw, vbCrLf, vbLf)
    lines = Split(raw, vbLf)
    For i = LBound(lines) To UBound(lines)
        ln = lines(i)
        If Left(LTrim(ln), 2) <> "--" Then cleaned = cleaned & ln & vbLf
    Next i

    stmts = Split(cleaned, ";")
    For i = LBound(stmts) To UBound(stmts)
        s = Trim(stmts(i))
        If Len(s) > 0 Then
            On Error Resume Next
            CurrentDb.Execute s & ";", dbFailOnError
            If Err.Number <> 0 Then
                skipCount = skipCount + 1
                Debug.Print "SKIP (" & Err.Number & "): " & Err.Description & "  ::  " & Left(s, 70)
                Err.Clear
            Else
                okCount = okCount + 1
            End If
            On Error GoTo 0
        End If
    Next i

    MsgBox "Schema build finished." & vbCrLf & _
           okCount & " statement(s) executed, " & skipCount & " skipped." & vbCrLf & _
           "Press Ctrl+G to see skipped statements in the Immediate window.", vbInformation
End Sub
