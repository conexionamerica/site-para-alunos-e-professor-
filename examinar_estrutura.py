import pandas as pd

# Examinar arquivo de dados
print("=" * 80)
print("ESTRUTURA DO ARQUIVO DE DADOS")
print("=" * 80)

df_dados = pd.read_excel('ProducaoRealizada_0_2025 (3).xlsx')
print(f"\nLinhas: {len(df_dados)}")
print(f"Colunas: {len(df_dados.columns)}")
print("\nNOMES DAS COLUNAS:")
for i, col in enumerate(df_dados.columns, 1):
    print(f"{i:3d}. {col}")

print("\n" + "=" * 80)
print("PRIMEIRAS 3 LINHAS DE EXEMPLO:")
print("=" * 80)
print(df_dados.head(3))

# Examinar arquivos de regras
print("\n\n" + "=" * 80)
print("ESTRUTURA DO ARQUIVO DE REGRAS (TODAS_RPS)")
print("=" * 80)

df_regras = pd.read_excel('Mapas Estatísticos - RPS DN/TODAS_RPS 2025.xlsx')
print(f"\nLinhas: {len(df_regras)}")
print(f"Colunas: {len(df_regras.columns)}")
print("\nNOMES DAS COLUNAS:")
for i, col in enumerate(df_regras.columns, 1):
    print(f"{i:3d}. {col}")

print("\n" + "=" * 80)
print("PRIMEIRAS 5 LINHAS DE EXEMPLO:")
print("=" * 80)
print(df_regras.head(5))
