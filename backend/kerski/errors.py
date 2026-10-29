"""User-safe errors: never expose signed media URLs or remote response bodies."""
def describe_error(exc):
    if isinstance(exc, ValueError):
        return str(exc)[:400]
    text = str(exc).lower()
    if isinstance(exc, FileNotFoundError):
        return 'Uma ferramenta de vídeo não foi encontrada neste computador. Reinicie o Kerski pelo atalho.'
    if '429' in text or 'too many requests' in text:
        return 'A plataforma limitou temporariamente as solicitações. Aguarde alguns minutos antes de tentar novamente.'
    if any(x in text for x in ('login required', 'sign in', 'log in', 'private video', 'cookies')):
        return 'A plataforma exige login para acessar este vídeo. O Kerski não acessa conteúdo restrito à sua conta.'
    if '403' in text or 'forbidden' in text:
        return 'A plataforma recusou o acesso ao arquivo (403). Analise o link novamente e tente outro formato disponível.'
    if any(x in text for x in ('timed out', 'timeout', 'unable to connect', 'name resolution')):
        return 'Não foi possível conectar à plataforma. Verifique a internet e tente novamente.'
    if any(x in text for x in ('video unavailable', 'removed', 'not available')):
        return 'A plataforma informou que este vídeo está indisponível. Confira se o link abre no navegador sem login.'
    return 'Não foi possível concluir o processamento. Tente analisar o link novamente. Se persistir, envie o link para verificarmos.'
