import pandas as pd

# Examinar arquivo de dados - apenas colunas
print("Examinando arquivos...")

with open('estrutura_arquivos.txt', 'w', encoding='utf-8') as f:
    try:
        df_dados = pd.read_excel('ProducaoRealizada_0_2025 (3).xlsx', nrows=3)
        f.write("="*80 + "\n")
        f.write("ARQUIVO DE DADOS\n")
        f.write("="*80 + "\n")
        f.write(f"Colunas ({len(df_dados.columns)}):\n\n")
        for i, col in enumerate(df_dados.columns, 1):
            f.write(f"{i:3d}. {col}\n")
        
        f.write("\n\nPrimeira linha de exemplo:\n")
        f.write(str(df_dados.iloc[0]))
    except Exception as e:
        f.write(f"Erro ao ler dados: {e}\n")
    
    f.write("\n\n" + "="*80 + "\n")
    f.write("ARQUIVO DE REGRAS\n")
    f.write("="*80 + "\n")
    
    try:
        df_regras = pd.read_excel('Mapas Estatísticos - RPS DN/TODAS_RPS 2025.xlsx', nrows=5)
        f.write(f"Colunas ({len(df_regras.columns)}):\n\n")
        for i, col in enumerate(df_regras.columns, 1):
            f.write(f"{i:3d}. {col}\n")
        
        f.write("\n\nPrimeiras linhas de exemplo:\n")
        f.write(df_regras.to_string())
    except Exception as e:
        f.write(f"Erro ao ler regras: {e}\n")

print("Concluido! Veja o arquivo estrutura_arquivos.txt")
