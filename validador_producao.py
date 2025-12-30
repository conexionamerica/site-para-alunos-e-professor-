"""
===================================================
SISTEMA DE VALIDAÇÃO DE PRODUÇÃO SESC
===================================================
Valida dados de atendimentos contra regras por serviço
Autor: Gerado automaticamente
Data: 2025-12-30
"""

import pandas as pd
import numpy as np
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# ========================================================
# CONFIGURAÇÕES
# ========================================================

ARQUIVO_DADOS = 'ProducaoRealizada_0_2025 (3).xlsx'
ARQUIVO_REGRAS = 'Mapas Estatísticos - RPS DN/TODAS_RPS 2025.xlsx'
ARQUIVO_RELATORIO = 'Relatorio_Validacao_Producao.xlsx'

# ========================================================
# CLASSE PRINCIPAL
# ========================================================

class ValidadorProducaoSESC:
    """Validador de dados de produção do SESC"""
    
    def __init__(self):
        self.df_dados = None
        self.df_regras = None
        self.dict_regras = {}
        self.erros = []
        self.avisos = []
        self.estatisticas = {}
        
    def carregar_dados(self):
        """Carrega o arquivo de dados de produção"""
        print("="*80)
        print("CARREGANDO ARQUIVO DE DADOS")
        print("="*80)
        
        # Ler pulando as 6 primeiras linhas (filtros) e usando linha 7 como header
        self.df_dados = pd.read_excel(ARQUIVO_DADOS, header=6)
        
        print(f"\n✅ Arquivo carregado com sucesso!")
        print(f"   📊 Total de registros: {len(self.df_dados):,}")
        print(f"   📁 Total de colunas: {len(self.df_dados.columns)}")
        
        # Mostrar informações básicas
        print(f"\n📌 Colunas principais identificadas:")
        print(f"   - Serviço: SERVICOS_CNS")
        print(f"   - Unidade de Produção: UNIDADEPRODUCAO")  
        print(f"   - Categoria: NOME_CATEGORIA_DN")
        print(f"   - Mês: MES")
        print(f"   - Quantidade: QUANTIDADE")
        
        return self
    
    def carregar_regras(self):
        """Carrega e processa as regras de validação"""
        print("\n" + "="*80)
        print("CARREGANDO REGRAS DE VALIDAÇÃO")
        print("="*80)
        
        # Ler arquivo de regras sem header
        df_raw = pd.read_excel(ARQUIVO_REGRAS, header=None)
        
        print(f"\n✅ Arquivo de regras carregado!")
        print(f"   📊 Total de linhas: {len(df_raw)}")
        
        # Processar regras
        self._processar_regras(df_raw)
        
        print(f"\n📌 Regras processadas:")
        print(f"   - Total de serviços mapeados: {len(self.dict_regras)}")
        print(f"   - Primeiros serviços: {list(self.dict_regras.keys())[:5]}")
        
        return self
    
    def _processar_regras(self, df_raw):
        """Processa o arquivo de regras em estrutura utilizável"""
        
        # Vamos identificar as linhas que contêm nomes de serviços
        # Serviços estão na coluna 1 e têm "x" nas colunas subsequentes
        
        subatividade_atual = None
        headers_atuais = []
        subcategorias = []
        
        for idx, row in df_raw.iterrows():
            # Identificar início de subatividade
            if pd.notna(row[1]) and 'Subatividade' in str(row[1]):
                subatividade_atual = row[1]
                continue
            
            # Identificar cabeçalhos (linhas com "Serviços")
            if pd.notna(row[1]) and row[1] == 'Serviços':
                # Capturar headers da linha
                headers_atuais = []
                for col_idx in range(2, len(row)):
                    if pd.notna(row[col_idx]):
                        headers_atuais.append((col_idx, row[col_idx]))
                continue
            
            # Identificar subcategorias (Com., Dep., P.G., etc.)
            if pd.notna(row[2]) or pd.notna(row[3]):
                # Esta é a linha de subcategorias
                subcategorias = []
                for col_idx in range(2, len(row)):
                    if pd.notna(row[col_idx]):
                        subcategorias.append((col_idx, row[col_idx]))
                continue
            
            # Linhas com nomes de serviços
            if pd.notna(row[1]) and row[1] not in ['NaN', '', 'Serviços']:
                servico = row[1]
                
                # Mapear campos obrigatórios
                campos_obrigatorios = []
                
                for col_idx in range(2, len(row)):
                    valor = row[col_idx]
                    if pd.notna(valor) and str(valor).lower() == 'x':
                        # Encontrar o header correspondente
                        header_base = None
                        for h_idx, h_nome in headers_atuais:
                            if col_idx >= h_idx:
                                header_base = h_nome
                        
                        # Encontrar subcategoria
                        subcat = None
                        for s_idx, s_nome in subcategorias:
                            if col_idx == s_idx:
                                subcat = s_nome
                                break
                        
                        # Criar nome completo do campo
                        if header_base:
                            if subcat and subcat not in ['NaN', '']:
                                campo = f"{header_base} / {subcat}"
                            else:
                                campo = header_base
                            campos_obrigatorios.append(campo)
                
                # Armazenar no dicionário
                if campos_obrigatorios:
                    self.dict_regras[servico] = {
                        'subatividade': subatividade_atual,
                        'campos_obrigatorios': campos_obrigatorios
                    }
    
    def validar_campos_obrigatorios(self):
        """Valida se campos obrigatórios estão preenchidos"""
        print("\n" + "="*80)
        print("VALIDANDO CAMPOS OBRIGATÓRIOS")
        print("="*80)
        
        # Agrupar dados por Projeto + Serviço + Mês
        grupos = self.df_dados.groupby(['PROJETO', 'SERVICOS_CNS', 'MES'])
        
        total_grupos = len(grupos)
        print(f"\n🔍 Analisando {total_grupos:,} grupos (Projeto + Serviço + Mês)...")
        
        contador = 0
        erros_encontrados = 0
        
        for nome_grupo, grupo in grupos:
            contador += 1
            if contador % 1000 == 0:
                print(f"   Processados {contador:,}/{total_grupos:,} grupos...")
            
            projeto, servico, mes = nome_grupo
            
            # Buscar regras para este serviço
            if servico not in self.dict_regras:
                # Serviço sem regras definidas
                continue
            
            regras = self.dict_regras[servico]
            campos_obrigatorios = regras['campos_obrigatorios']
            
            # Para cada campo obrigatório, verificar se existe no grupo
            for campo_obrigatorio in campos_obrigatorios:
                # Verificar se existe registro com esse campo
                # O campo está na coluna UNIDADEPRODUCAO ou NOME_CATEGORIA_DN
                
                encontrado = False
                
                for _, linha in grupo.iterrows():
                    unidade = str(linha.get('UNIDADEPRODUCAO', ''))
                    categoria = str(linha.get('NOME_CATEGORIA_DN', ''))
                    
                    # Verificar se a linha corresponde ao campo obrigatório
                    if campo_obrigatorio in unidade or campo_obrigatorio in categoria:
                        # Campo encontrado, verificar se tem quantidade
                        quantidade = linha.get('QUANTIDADE', 0)
                        if pd.notna(quantidade) and quantidade > 0:
                            encontrado = True
                            break
                
                if not encontrado:
                    # Campo obrigatório não encontrado ou vazio
                    erros_encontrados += 1
                    
                    self.erros.append({
                        'tipo': 'CAMPO_OBRIGATORIO_AUSENTE',
                        'projeto': projeto,
                        'servico': servico,
                        'mes': mes,
                        'campo': campo_obrigatorio,
                        'mensagem': f"Campo obrigatório '{campo_obrigatorio}' ausente ou vazio"
                    })
        
        print(f"\n✅ Validação concluída!")
        print(f"   ❌ Erros encontrados: {erros_encontrados:,}")
        
        return self
    
    def validar_consistencia_publico(self):
        """Valida hierarquia: Inscrições >= Presença >= Pessoas atendidas"""
        print("\n" + "="*80)
        print("VALIDANDO CONSISTÊNCIA DE PÚBLICO")
        print("="*80)
        
        # Agrupar por Projeto + Serviço + Mês + Categoria
        grupos = self.df_dados.groupby(['PROJETO', 'SERVICOS_CNS', 'MES', 'NOME_CATEGORIA_DN'])
        
        total_grupos = len(grupos)
        print(f"\n🔍 Analisando {total_grupos:,} grupos...")
        
        contador = 0
        inconsistencias = 0
        
        for nome_grupo, grupo in grupos:
            contador += 1
            if contador % 1000 == 0:
                print(f"   Processados {contador:,}/{total_grupos:,} grupos...")
            
            projeto, servico, mes, categoria = nome_grupo
            
            # Buscar valores de inscrições, presença e pessoas atendidas
            inscricoes = 0
            presenca = 0
            pessoas_atendidas = 0
            
            for _, linha in grupo.iterrows():
                unidade = str(linha.get('UNIDADEPRODUCAO', '')).upper()
                quantidade = linha.get('QUANTIDADE', 0)
                
                if pd.isna(quantidade):
                    quantidade = 0
                
                if 'INSCRI' in unidade:
                    inscricoes += quantidade
                elif 'PRESEN' in unidade:
                    presenca += quantidade
                elif 'ATENDID' in unidade or 'PESSOA' in unidade:
                    pessoas_atendidas += quantidade
            
            # Validar hierarquia
            if inscricoes > 0 or presenca > 0 or pessoas_atendidas > 0:
                
                if presenca > inscricoes and inscricoes > 0:
                    inconsistencias += 1
                    self.erros.append({
                        'tipo': 'INCONSISTENCIA_PUBLICO',
                        'projeto': projeto,
                        'servico': servico,
                        'mes': mes,
                        'categoria': categoria,
                        'mensagem': f"Presença ({presenca:,}) > Inscrições ({inscricoes:,})"
                    })
                
                if pessoas_atendidas > presenca and presenca > 0:
                    inconsistencias += 1
                    self.erros.append({
                        'tipo': 'INCONSISTENCIA_PUBLICO',
                        'projeto': projeto,
                        'servico': servico,
                        'mes': mes,
                        'categoria': categoria,
                        'mensagem': f"Pessoas Atendidas ({pessoas_atendidas:,}) > Presença ({presenca:,})"
                    })
                
                if pessoas_atendidas > inscricoes and inscricoes > 0:
                    inconsistencias += 1
                    self.erros.append({
                        'tipo': 'INCONSISTENCIA_PUBLICO',
                        'projeto': projeto,
                        'servico': servico,
                        'mes': mes,
                        'categoria': categoria,
                        'mensagem': f"Pessoas Atendidas ({pessoas_atendidas:,}) > Inscrições ({inscricoes:,})"
                    })
        
        print(f"\n✅ Validação concluída!")
        print(f"   ⚠️  Inconsistências encontradas: {inconsistencias:,}")
        
        return self
    
    def gerar_relatorio(self):
        """Gera relatório completo em Excel"""
        print("\n" + "="*80)
        print("GERANDO RELATÓRIO")
        print("="*80)
        
        if not self.erros:
            print("\n🎉 PARABÉNS! Nenhum erro encontrado!")
            print("   Todos os dados estão consistentes e completos.")
            return self
        
        # Criar DataFrame de erros
        df_erros = pd.DataFrame(self.erros)
        
        # Estatísticas
        total_erros = len(df_erros)
        erros_por_tipo = df_erros['tipo'].value_counts()
        erros_por_servico = df_erros['servico'].value_counts().head(10)
        
        print(f"\n📊 ESTATÍSTICAS:")
        print(f"   Total de erros: {total_erros:,}")
        print(f"\n   Erros por tipo:")
        for tipo, qtd in erros_por_tipo.items():
            print(f"      - {tipo}: {qtd:,}")
        
        # Salvar em Excel
        with pd.ExcelWriter(ARQUIVO_RELATORIO, engine='openpyxl') as writer:
            # Aba 1: Todos os erros
            df_erros.to_excel(writer, sheet_name='Todos os Erros', index=False)
            
            # Aba 2: Resumo por tipo
            resumo_tipo = pd.DataFrame({
                'Tipo de Erro': erros_por_tipo.index,
                'Quantidade': erros_por_tipo.values
            })
            resumo_tipo.to_excel(writer, sheet_name='Resumo por Tipo', index=False)
            
            # Aba 3: Top 10 serviços com mais erros
            resumo_servico = pd.DataFrame({
                'Serviço': erros_por_servico.index,
                'Quantidade de Erros': erros_por_servico.values
            })
            resumo_servico.to_excel(writer, sheet_name='Top 10 Serviços', index=False)
            
            # Aba 4: Erros por projeto
            if 'projeto' in df_erros.columns:
                erros_por_projeto = df_erros['projeto'].value_counts().head(10)
                resumo_projeto = pd.DataFrame({
                    'Projeto': erros_por_projeto.index,
                    'Quantidade de Erros': erros_por_projeto.values
                })
                resumo_projeto.to_excel(writer, sheet_name='Top 10 Projetos', index=False)
            
            # Aba 5: Estatísticas gerais
            total_registros = len(self.df_dados)
            taxa_erro = (total_erros / total_registros * 100) if total_registros > 0 else 0
            
            df_stats = pd.DataFrame({
                'Métrica': [
                    'Total de Registros Analisados',
                    'Total de Erros Encontrados',
                    'Taxa de Erro (%)',
                    'Campos Obrigatórios Ausentes',
                    'Inconsistências de Público',
                ],
                'Valor': [
                    f"{total_registros:,}",
                    f"{total_erros:,}",
                    f"{taxa_erro:.2f}%",
                    f"{len(df_erros[df_erros['tipo']=='CAMPO_OBRIGATORIO_AUSENTE']):,}",
                    f"{len(df_erros[df_erros['tipo']=='INCONSISTENCIA_PUBLICO']):,}",
                ]
            })
            df_stats.to_excel(writer, sheet_name='Estatísticas Gerais', index=False)
        
        print(f"\n✅ Relatório salvo em: {ARQUIVO_RELATORIO}")
        print(f"   📑 {len(writer.sheets)} abas criadas")
        
        return self

# ========================================================
# FUNÇÃO PRINCIPAL
# ========================================================

def main():
    """Executa a validação completa"""
    
    print("\n")
    print("=" * 80)
    print(" " * 20 + "VALIDADOR DE PRODUCAO SESC")
    print(" " * 28 + "Versao 1.0")
    print("=" * 80)
    print()
    
    try:
        # Criar validador
        validador = ValidadorProducaoSESC()
        
        # Executar pipeline de validação
        validador.carregar_dados() \
                 .carregar_regras() \
                 .validar_campos_obrigatorios() \
                 .validar_consistencia_publico() \
                 .gerar_relatorio()
        
        print("\n" + "="*80)
        print("✅ VALIDAÇÃO CONCLUÍDA COM SUCESSO!")
        print("="*80)
        print()
        
    except Exception as e:
        print("\n" + "="*80)
        print(f"❌ ERRO DURANTE A EXECUÇÃO")
        print("="*80)
        print(f"\n{str(e)}\n")
        
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
