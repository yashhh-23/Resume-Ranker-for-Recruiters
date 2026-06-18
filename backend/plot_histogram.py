import csv
from pathlib import Path
from collections import Counter

def main():
    csv_file = Path("submission.csv")
    if not csv_file.exists():
        print(f"Error: {csv_file} not found.")
        return
        
    scores = []
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                scores.append(float(row['score']))
            except (ValueError, KeyError):
                pass
                
    if not scores:
        print("No scores found in submission.csv")
        return

    # Categorize into tiers
    tiers = {
        "Tier A (Strong Match) >= 0.60": 0,
        "Tier B (Moderate Match) 0.35 - 0.59": 0,
        "Tier C (Weak Match) 0.15 - 0.34": 0,
        "Tier D (Marginal) < 0.15": 0
    }
    
    for s in scores:
        if s >= 0.60:
            tiers["Tier A (Strong Match) >= 0.60"] += 1
        elif s >= 0.35:
            tiers["Tier B (Moderate Match) 0.35 - 0.59"] += 1
        elif s >= 0.15:
            tiers["Tier C (Weak Match) 0.15 - 0.34"] += 1
        else:
            tiers["Tier D (Marginal) < 0.15"] += 1
            
    print("\n--- Score Distribution ---")
    total = len(scores)
    
    # ASCII Histogram
    max_count = max(tiers.values()) if tiers.values() else 1
    BAR_MAX_LEN = 40
    
    for label, count in tiers.items():
        pct = (count / total) * 100
        bar_len = int((count / max_count) * BAR_MAX_LEN)
        bar = "#" * bar_len
        print(f"{label.ljust(35)} | {bar} {count} ({pct:.1f}%)")
        
    # Attempt to plot using matplotlib
    try:
        import matplotlib.pyplot as plt
        
        labels = [
            "Tier A (>= 0.60)\nStrong", 
            "Tier B (0.35-0.59)\nModerate", 
            "Tier C (0.15-0.34)\nWeak", 
            "Tier D (< 0.15)\nMarginal"
        ]
        counts = [
            tiers["Tier A (Strong Match) >= 0.60"],
            tiers["Tier B (Moderate Match) 0.35 - 0.59"],
            tiers["Tier C (Weak Match) 0.15 - 0.34"],
            tiers["Tier D (Marginal) < 0.15"]
        ]
        
        plt.figure(figsize=(10, 6))
        bars = plt.bar(labels, counts, color=['#2ca02c', '#1f77b4', '#ff7f0e', '#d62728'])
        plt.title('Candidate Score Distribution', fontsize=16)
        plt.ylabel('Number of Candidates', fontsize=12)
        
        # Add text labels on top of bars
        for bar, count in zip(bars, counts):
            height = bar.get_height()
            plt.text(bar.get_x() + bar.get_width()/2., height + 0.5,
                     f'{count}', ha='center', va='bottom', fontsize=12)
                     
        plt.grid(axis='y', linestyle='--', alpha=0.7)
        plt.tight_layout()
        plt.savefig('score_distribution.png')
        print("\nSaved chart to 'score_distribution.png'")
        
    except ImportError:
        print("\nMatplotlib not installed. Skipping PNG generation.")

if __name__ == "__main__":
    main()
