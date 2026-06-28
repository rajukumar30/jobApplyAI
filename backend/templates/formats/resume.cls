\ProvidesClass{resume}[2010/07/10 v0.9 Resume class]
\LoadClass[11pt,letterpaper]{article}
\usepackage[parfill]{parskip}
\usepackage{array}
\usepackage{ifthen}
\nofiles
\pagestyle{empty}
\def \name#1{\def\@name{#1}}
\def \@name {}
\def \addressSep {$\diamond$}
\let \@addressone \relax
\let \@addresstwo \relax
\def \address #1{
 \@ifundefined{@addresstwo}{
 \def \@addresstwo {#1}
 }{
 \def \@addressone {#1}
 }
}
\def \printaddress #1{
 \begingroup
 \def \\ {\addressSep\ }
 \centerline{#1}
 \endgroup
 \par
 \addressskip
}
\def \printname {
 \begingroup
 \centerline{\textbf{\MakeUppercase{\namesize\@name}}}
 \endgroup
 \par
 \nameskip
}
\AtBeginDocument{
 \printname
 \@ifundefined{@addressone}{}{
 \printaddress{\@addressone}}
 \@ifundefined{@addresstwo}{}{
 \printaddress{\@addresstwo}}
}
\newenvironment{rSection}[1]{
 \sectionskip
 \textbf{\MakeUppercase{#1}}
 \sectionlineskip
 \hrule
 \begin{list}{}{
 \setlength{\leftmargin}{1.5em}
 }
 \item[]
}{
 \end{list}
}
\newenvironment{rSubsection}[4]{
 \textbf{#1} \hfill { #2}
 \ifthenelse{\equal{#3}{}}{}{
 \\
 \emph{#3} \hfill \emph{#4}
 }\smallskip
 \begin{list}{$\cdot$}{\leftmargin=0em}
 \itemsep -0.5em \vspace{-0.5em}
}{
 \end{list}
 \vspace{0.5em}
}
\def\namesize{\huge}
\def\nameskip{\medskip}
\def\addressskip{\smallskip}
\def\sectionskip{\bigskip}
\def\sectionlineskip{\medskip}
