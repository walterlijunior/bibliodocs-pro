"""Testes da estrutura do Kit Acadêmico para Claude Code (somente leitura).

Executar na pasta do kit:  python tests/test_estrutura_kit.py
Requer apenas a biblioteca padrão do Python 3.9+. Espelha as verificações de scripts/validar-kit.ps1.
"""
import hashlib
import json
import re
import sys
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

OBRIGATORIOS = [
    "README.md", "CLAUDE.md", "PROMPT_EXECUCAO.md", "INSTRUCOES_INICIAIS.md", "CHANGELOG.md", ".gitignore",
    ".claude/settings.json",
    "docs/VISAO_DO_PRODUTO.md", "docs/ARQUITETURA_PRELIMINAR.md", "docs/REQUISITOS_FUNCIONAIS.md",
    "docs/REQUISITOS_NAO_FUNCIONAIS.md", "docs/PLANO_DE_IMPLEMENTACAO.md", "docs/MATRIZ_DE_RISCOS.md",
    "docs/MATRIZ_DE_TESTES.md", "docs/POLITICA_DE_FONTES_NORMATIVAS.md", "docs/INVENTARIO_DE_MATERIAIS.md",
    "docs/RECURSOS_CLAUDE_CODE.md", "docs/ESTADO_DO_PROJETO.md", "docs/MATRIZ_DE_REQUISITOS_NORMATIVOS.md",
    "templates/ADR.md", "templates/RELATORIO_TECNICO.md", "templates/RELATORIO_DE_TESTES.md",
    "scripts/validar-kit.ps1", "scripts/verificar-ambiente.ps1", "tests/artefatos_futuros.txt",
    "materiais/LEIA-ME.md", "materiais/modelos_uft/LEIA-ME.md", "materiais/referencias_visuais/LEIA-ME.md",
    "analise/LEIA-ME.md", "app/LEIA-ME.md", "docs/REFERENCIA_DE_LAYOUT.md", "materiais/referencias_layout/LEIA-ME.md",
]
AGENTES = [
    "arquiteto-software", "especialista-normas", "especialista-documento", "especialista-referencias",
    "especialista-elementos-visuais", "especialista-interface", "engenheiro-qualidade", "revisor-seguranca",
]
NUM_SKILLS = 15
PREFIXOS = re.compile(r"^(docs|templates|scripts|tests|\.claude|materiais)/|^(README|CLAUDE|PROMPT_EXECUCAO|INSTRUCOES_INICIAIS|CHANGELOG)\.md$")
SEGREDOS = [
    r"sk-ant-[A-Za-z0-9_-]{10,}", r"AKIA[0-9A-Z]{16}", r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    r"ghp_[A-Za-z0-9]{30,}", r"xox[bp]-[A-Za-z0-9-]{10,}",
    r"\"?(api[_-]?key|token|password|senha)\"?\s*[:=]\s*\"[^\"\s]{12,}\"",
]


def ler(rel):
    return (RAIZ / rel).read_text(encoding="utf-8")


def frontmatter(caminho: Path):
    linhas = caminho.read_text(encoding="utf-8").splitlines()
    if len(linhas) < 3 or linhas[0].strip() != "---":
        return None, ""
    dados = {}
    for i, linha in enumerate(linhas[1:], start=1):
        if linha.strip() == "---":
            return dados, "\n".join(linhas[i + 1:])
        m = re.match(r"^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$", linha)
        if m:
            dados[m.group(1)] = m.group(2).strip().strip('"')
    return None, ""


class TestEstruturaKit(unittest.TestCase):
    def test_01_arquivos_obrigatorios(self):
        faltando = [f for f in OBRIGATORIOS if not (RAIZ / f).exists()]
        self.assertEqual(faltando, [], f"Ausentes: {faltando}")
        pequenos = [f for f in OBRIGATORIOS if (RAIZ / f).stat().st_size < 200]
        self.assertEqual(pequenos, [], f"Quase vazios: {pequenos}")

    def test_02_agentes(self):
        arquivos = sorted((RAIZ / ".claude/agents").glob("*.md"))
        self.assertEqual(sorted(a.stem for a in arquivos), sorted(AGENTES))
        for a in arquivos:
            fm, corpo = frontmatter(a)
            self.assertIsNotNone(fm, f"{a.name}: frontmatter inválido")
            self.assertEqual(fm.get("name"), a.stem, f"{a.name}: name diferente do arquivo")
            self.assertGreaterEqual(len(fm.get("description", "")), 40, f"{a.name}: description curta")
            self.assertGreaterEqual(len(corpo), 800, f"{a.name}: corpo curto")
        fm, _ = frontmatter(RAIZ / ".claude/agents/revisor-seguranca.md")
        self.assertNotRegex(fm.get("tools", ""), r"\b(Edit|Write)\b", "revisor-seguranca deve ser somente leitura")

    def test_03_skills(self):
        pastas = sorted(p for p in (RAIZ / ".claude/skills").iterdir() if p.is_dir())
        self.assertEqual(len(pastas), NUM_SKILLS)
        for p in pastas:
            sk = p / "SKILL.md"
            self.assertTrue(sk.exists(), f"{p.name}: sem SKILL.md")
            fm, _ = frontmatter(sk)
            self.assertIsNotNone(fm, f"{p.name}: frontmatter inválido")
            self.assertEqual(fm.get("name"), p.name)
            self.assertRegex(p.name, r"^[a-z0-9]+(-[a-z0-9]+)*$")
            self.assertLessEqual(len(p.name), 64)
            self.assertTrue(40 <= len(fm.get("description", "")) <= 1024, f"{p.name}: description fora do limite")
            self.assertGreaterEqual(len(sk.read_text(encoding="utf-8")), 700, f"{p.name}: instruções curtas")
        for cmd in ("iniciar-projeto", "status-projeto"):
            fm, _ = frontmatter(RAIZ / f".claude/skills/{cmd}/SKILL.md")
            self.assertEqual(fm.get("disable-model-invocation"), "true", f"/{cmd} deve ser só do usuário")

    def test_04_settings(self):
        cfg = json.loads(ler(".claude/settings.json"))
        deny = cfg["permissions"]["deny"]
        self.assertIn("Edit(/materiais/**)", deny)
        self.assertIn("Read(**/.env)", deny)
        amplas = {"Bash", "Bash(*)", "Edit", "Write", "PowerShell", "PowerShell(*)"}
        self.assertFalse(amplas & set(cfg["permissions"].get("allow", [])), "permissão ampla demais")

    def test_05_referencias_cruzadas(self):
        futuros = {l.strip() for l in ler("tests/artefatos_futuros.txt").splitlines() if l.strip() and not l.startswith("#")}
        fontes = [RAIZ / f for f in ("README.md", "CLAUDE.md", "PROMPT_EXECUCAO.md", "INSTRUCOES_INICIAIS.md")]
        fontes += list((RAIZ / ".claude").rglob("*.md")) + list((RAIZ / "docs").rglob("*.md"))
        quebradas, conferidas = [], 0
        for f in fontes:
            for ref in re.findall(r"`([^`\s]+)`", f.read_text(encoding="utf-8")):
                ref = ref.replace("\\", "/").rstrip("/.,)")
                if not PREFIXOS.search(ref) or re.search(r"[*<>]|NN|xxx|AAAA", ref):
                    continue
                if not re.search(r"\.(md|ps1|py|json|txt|zip|pdf)$", ref):
                    continue
                conferidas += 1
                if not (RAIZ / ref).exists() and ref not in futuros:
                    quebradas.append(f"{f.relative_to(RAIZ)} -> {ref}")
        self.assertGreater(conferidas, 30)
        self.assertEqual(sorted(set(quebradas)), [])

    def test_06_documentacao_cita_agentes_e_skills(self):
        readme, recursos = ler("README.md"), ler("docs/RECURSOS_CLAUDE_CODE.md")
        nomes = AGENTES + [p.name for p in (RAIZ / ".claude/skills").iterdir() if p.is_dir()]
        ausentes = [n for n in nomes if n not in readme or n not in recursos]
        self.assertEqual(ausentes, [])

    def test_07_sem_segredos(self):
        achados = []
        for arq in RAIZ.rglob("*"):
            if not arq.is_file():
                continue
            if arq.name in {".env", ".credentials.json", "settings.local.json", ".claude.json"}:
                achados.append(str(arq))
            if arq.suffix in {".md", ".json", ".ps1", ".py", ".txt"} or arq.name == ".gitignore":
                if arq.name in {"validar-kit.ps1", "test_estrutura_kit.py"}:
                    continue
                texto = arq.read_text(encoding="utf-8", errors="replace")
                achados += [f"{arq.relative_to(RAIZ)} ({p})" for p in SEGREDOS if re.search(p, texto)]
        self.assertEqual(achados, [])

    def test_08_checksums_materiais(self):
        inv = ler("docs/INVENTARIO_DE_MATERIAIS.md")
        pares = re.findall(r"`(materiais/[^`]+\.(?:zip|pdf|md|doc|docx|png))`[^\r\n]*?`([0-9a-f]{64})`", inv)
        self.assertGreaterEqual(len(pares), 3)
        for rel, esperado in pares:
            real = hashlib.sha256((RAIZ / rel).read_bytes()).hexdigest()
            self.assertEqual(real, esperado, f"checksum diferente: {rel}")

    def test_09_gitignore_protege_pessoal(self):
        gi = ler(".gitignore")
        for item in (".claude/settings.local.json", ".env", "node_modules/", "analise/*"):
            self.assertIn(item, gi)


if __name__ == "__main__":
    resultado = unittest.main(verbosity=2, exit=False).result
    sys.exit(0 if resultado.wasSuccessful() else 1)
