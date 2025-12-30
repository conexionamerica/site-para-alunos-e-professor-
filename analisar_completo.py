import pandas as pd

# Ler sem assumir headers
print("Analisando arquivo de dados...")
df_dados = pd.read_excel('ProducaoRealizada_0_2025 (3).xlsx', header=None)

with open('estrutura_completa.txt', 'w', encoding='utf-8') as f:
    f.write("="*100 + "\n")
    f.write("ARQUIVO DE DADOS - PRIMEIRAS 30 LINHAS\n")
    f.write("="*100 + "\n\n")
    f.write(f"Dimensões: {df_dados.shape[0]} linhas x {df_dados.shape[1]} colunas\n\n")
    f.write(df_dados.head(30).to_string())
    
    f.write("\n\n" + "="*100 + "\n")
    f.write("ARQUIVO DE REGRAS - PRIMEIRAS 30 LINHAS\n")
    f.write("="*100 + "\n\n")
    
    df_regras = pd.read_excel('Mapas Estatísticos - RPS DN/TODAS_RPS 2025.xlsx', header=None)
    f.write(f"Dimensões: {df_regras.shape[0]} linhas x {df_regras.shape[1]} colunas\n\n")
    f.write(df_regras.head(30).to_string())

print("Arquivo estrutura_completa.txt criado!")
